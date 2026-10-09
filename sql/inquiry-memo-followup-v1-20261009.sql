-- Install after inquiry-memo-review-v1-20261008.sql (#537 receipt version).
-- One transaction: unfinished promise decision + next action + both audit events.
-- Existing actions retain their identity, type and full due timestamp, even overdue.
-- No backfill, automatic notification, contact event, stage or performance changes.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='60s';

DO $guard$ BEGIN
 IF to_regclass('crm_security.inquiry_memo_receipts') IS NULL
  OR to_regprocedure('public.crm_inquiry_memo_review_v1(jsonb)') IS NULL
 THEN RAISE EXCEPTION 'memo receipt prerequisite missing'; END IF;
END $guard$;

CREATE TABLE IF NOT EXISTS crm_security.inquiry_memo_followup_receipts(
 inquiry_id uuid NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 actor_user_id uuid NOT NULL,
 payload jsonb NOT NULL,
 next_action jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(inquiry_id,request_id)
);
ALTER TABLE crm_security.inquiry_memo_followup_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_security.inquiry_memo_followup_receipts FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.crm_inquiry_memo_followup_v1(p jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 a record; q public.inquiries%rowtype; n public.next_actions%rowtype;
 h crm_security.inquiry_memo_followup_receipts%rowtype;
 v_id uuid; v_rid uuid; v_next jsonb; v_expected jsonb; v_review jsonb; v_current jsonb;
 v_count integer; v_title text; v_due date; v_owner text; v_latest text;
 v_at timestamptz; v_audit uuid; v_before jsonb; v_replay boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 -- Same lock order as existing inquiry commands; inquiry serializes all reviews.
 PERFORM 1 FROM public.users u WHERE u.auth_uid=auth.uid() FOR SHARE;
 PERFORM 1 FROM crm_security.access_review r WHERE r.reviewed_auth_uid=auth.uid() FOR SHARE;
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role NOT IN ('admin','rep','consultation') THEN
  RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
 END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR p->>'type' IS DISTINCT FROM 'promise'
  OR p->>'result' IS DISTINCT FROM '미완료'
  OR jsonb_typeof(p->'next_action') IS DISTINCT FROM 'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN ('inquiry_id','request_id','type','item_key','title','source_text','on_date','result','next_action')) THEN
  RAISE EXCEPTION 'invalid payload: 미완료 약속만 함께 저장할 수 있습니다' USING ERRCODE='22023';
 END IF;
 v_id:=(p->>'inquiry_id')::uuid; v_rid:=(p->>'request_id')::uuid;
 IF v_id IS NULL OR v_rid IS NULL THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM crm_security.object_scope s WHERE s.user_id=a.user_id AND s.inquiry_id=v_id FOR SHARE;
 SELECT * INTO q FROM public.inquiries i WHERE i.id=v_id FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_inquiry(v_id) OR q.assigned_to IS NULL
  OR (a.permission_role<>'admin' AND q.assigned_to IS DISTINCT FROM a.user_id)
  OR coalesce(q.inquiry_type,'')='기술자문' OR coalesce(q.brand,'')='기술자문' THEN
  RAISE EXCEPTION 'forbidden: 담당자 또는 관리자만 저장할 수 있습니다' USING ERRCODE='42501';
 END IF;
 SELECT e.action INTO v_latest FROM crm_security.inquiry_audit_events e
  WHERE e.inquiry_id=v_id AND e.action IN ('inquiry_trash','inquiry_restore','inquiry_purge')
  ORDER BY e.created_at DESC,e.event_id DESC LIMIT 1;
 IF v_latest IN ('inquiry_trash','inquiry_purge') OR coalesce(q.status,'') IN ('수주','실주','배드핏','연락두절','종결','종료') THEN
  RAISE EXCEPTION 'invalid payload: 종료되거나 삭제된 문의에는 할 일을 등록할 수 없습니다' USING ERRCODE='22023';
 END IF;
 v_at:=clock_timestamp();
 SELECT coalesce(u.name,q.assignee_name) INTO v_owner FROM public.users u WHERE u.user_id=q.assigned_to;
 IF nullif(btrim(v_owner),'') IS NULL THEN RAISE EXCEPTION 'forbidden: 담당자를 확인해 주세요' USING ERRCODE='42501'; END IF;
 v_next:=p->'next_action'; v_expected:=v_next->'expected'; v_title:=btrim(v_next->>'text');
 IF NOT v_next ?& ARRAY['text','due','expected'] OR jsonb_typeof(v_next->'text') IS DISTINCT FROM 'string'
  OR jsonb_typeof(v_next->'due') IS DISTINCT FROM 'string'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(v_next) k WHERE k NOT IN ('text','due','expected'))
  OR length(v_title) NOT BETWEEN 1 AND 500 OR v_next->>'due' !~ '^\d{4}-\d{2}-\d{2}$'
  OR jsonb_typeof(v_expected) NOT IN ('object','null') THEN
  RAISE EXCEPTION 'invalid payload: 다음 할 일을 확인해 주세요' USING ERRCODE='22023';
 END IF;
 BEGIN v_due:=(v_next->>'due')::date;
 EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
  RAISE EXCEPTION 'invalid payload: 다음 할 일 날짜를 확인해 주세요' USING ERRCODE='22023';
 END;
 -- Lock actions as well as inquiry; preserve other actors' newer work.
 PERFORM 1 FROM public.next_actions x WHERE x.inquiry_id=v_id AND x.status='open' ORDER BY x.id FOR UPDATE;
 SELECT count(*) INTO v_count FROM public.next_actions x WHERE x.inquiry_id=v_id AND x.status='open';
 IF v_count>1 THEN RAISE EXCEPTION 'invalid payload: 여러 할 일이 있어 먼저 확인해야 합니다' USING ERRCODE='22023'; END IF;
 SELECT * INTO n FROM public.next_actions x WHERE x.inquiry_id=v_id AND x.status='open';
 v_current:=CASE WHEN v_count=1 THEN jsonb_build_object('id',n.id,'type',n.action_type,'text',n.title,
  'due',(n.due_at AT TIME ZONE 'Asia/Seoul')::date,'due_at',n.due_at,'assignee',n.assignee_name,'status',n.status) ELSE 'null'::jsonb END;
 SELECT * INTO h FROM crm_security.inquiry_memo_followup_receipts x WHERE x.inquiry_id=v_id AND x.request_id=v_rid;
 v_replay:=FOUND;
 IF v_replay THEN
  IF h.actor_user_id IS DISTINCT FROM a.user_id OR h.payload IS DISTINCT FROM p THEN
   RAISE EXCEPTION 'invalid payload: 같은 요청 ID에 다른 내용을 담을 수 없습니다' USING ERRCODE='22023';
  END IF;
  IF h.next_action IS DISTINCT FROM v_current THEN
   RAISE EXCEPTION 'invalid payload: 처리 후 할 일이 변경됐습니다. 최신 내용을 다시 확인해 주세요' USING ERRCODE='22023';
  END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM crm_security.inquiry_memo_receipts x WHERE x.inquiry_id=v_id AND x.request_id=v_rid) THEN
   RAISE EXCEPTION 'invalid payload: 이미 사용한 판단 요청 ID입니다' USING ERRCODE='22023';
  END IF;
  IF (v_count=0 AND v_expected IS DISTINCT FROM 'null'::jsonb)
   OR (v_count=1 AND (v_expected IS DISTINCT FROM jsonb_build_object('id',n.id,'text',n.title,
      'type',n.action_type,'due',(n.due_at AT TIME ZONE 'Asia/Seoul')::date)
     OR n.assignee_name IS DISTINCT FROM v_owner OR v_due IS DISTINCT FROM (n.due_at AT TIME ZONE 'Asia/Seoul')::date)) THEN
   RAISE EXCEPTION 'invalid payload: 기존 할 일이 변경됐습니다. 최신 내용을 다시 확인해 주세요' USING ERRCODE='22023';
  END IF;
  IF v_count=0 AND v_due IS DISTINCT FROM (v_at AT TIME ZONE 'Asia/Seoul')::date THEN
   RAISE EXCEPTION 'invalid payload: 새 확인 업무의 날짜를 다시 확인해 주세요' USING ERRCODE='22023';
  END IF;
 END IF;
 -- Rechecks receipt freshness (A→B→A), ownership and review evidence. Any error
 -- in the following action/audit/receipt also rolls this review back.
 v_review:=public.crm_inquiry_memo_review_v1(p-'next_action');
 IF NOT v_replay THEN
  v_before:=v_current;
  IF v_count=1 THEN
   UPDATE public.next_actions SET title=v_title,updated_at=v_at WHERE id=n.id RETURNING * INTO n;
  ELSE
   INSERT INTO public.next_actions(inquiry_id,action_type,title,due_at,assignee_name,status,created_at,updated_at)
    VALUES(v_id,'전화',v_title,v_due::timestamp AT TIME ZONE 'Asia/Seoul',v_owner,'open',v_at,v_at) RETURNING * INTO n;
  END IF;
  UPDATE public.inquiries SET next_action_date=v_due,updated_at=v_at WHERE id=v_id;
  INSERT INTO crm_security.inquiry_audit_events(actor_auth_uid,actor_user_id,inquiry_id,action,before_data,after_data,reason,created_at)
   VALUES(a.auth_uid,a.user_id,v_id,'inquiry_next_set',jsonb_build_object('next_action',v_before,'next_action_date',q.next_action_date),
    jsonb_build_object('next_action_id',n.id,'type',n.action_type,'text',n.title,'next_action_date',v_due,
     'assignee_name',v_owner,'actor',a.display_name,'request_id',v_rid,'memo_item_key',p->>'item_key'),
    '과거 약속 미완료 확인과 다음 할 일 함께 저장',v_at) RETURNING event_id INTO v_audit;
  v_current:=jsonb_build_object('id',n.id,'type',n.action_type,'text',n.title,'due',v_due,
   'due_at',n.due_at,'assignee',n.assignee_name,'status',n.status);
  INSERT INTO crm_security.inquiry_memo_followup_receipts(inquiry_id,request_id,actor_user_id,payload,next_action,created_at)
   VALUES(v_id,v_rid,a.user_id,p,v_current,v_at);
 END IF;
 RETURN v_review||jsonb_build_object('request_id',v_rid,'next_action',v_current,'replayed',v_replay,
  'next_action_audit_event_id',v_audit);
END $fn$;
REVOKE ALL ON FUNCTION public.crm_inquiry_memo_followup_v1(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crm_inquiry_memo_followup_v1(jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
