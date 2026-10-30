-- 영업건 내부 메모 삭제 v1 (2026-10-30 대표 "내부메모 삭제가능하게" · 방식 = 숨김 삭제)
--   · 화면에서 지운 메모는 public.activities 에서 빠지고, 원래 행 전체를 crm_security.activity_memo_hidden 에 그대로 옮겨 둔다
--     → 모든 읽기 경로(영업건 상세 · 대시보드 · 연결 기록 · 색인)에서 저절로 사라지고, 원문 · 쓴 사람 · 지운 사람 · 시각은 서버에 남는다.
--   · 지울 수 있는 것: 유형 '메모'(내부 메모)만. 쓴 본인(이메일 또는 이름 일치) 또는 관리자. 볼 수 없는 영업건은 거절.
--   · 다른 기록이 이 메모를 가리키면(외래 키) 지우지 않고 거절한다.
--   · 되살리기는 화면 없이 관리자 SQL(아래 주석) — 같은 id 로 다시 넣으면 색인 트리거가 다시 만든다.
--   · 다시 실행해도 안전하다. 운영 적용: 대표 Run.
BEGIN;

CREATE TABLE IF NOT EXISTS crm_security.activity_memo_hidden(
 activity_id uuid PRIMARY KEY,
 deal_id uuid,
 original jsonb NOT NULL,
 author_name text,
 hidden_by_user_id uuid NOT NULL,
 hidden_by_name text NOT NULL,
 hidden_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS activity_memo_hidden_deal_idx ON crm_security.activity_memo_hidden(deal_id,hidden_at DESC);
ALTER TABLE crm_security.activity_memo_hidden ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE crm_security.activity_memo_hidden FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.crm_activity_memo_hide_v1(p jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a record; r public.activities%ROWTYPE; h crm_security.activity_memo_hidden%ROWTYPE; v_id uuid; v_email text;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END IF;
 BEGIN v_id:=(p->>'activity_id')::uuid; EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END;
 IF v_id IS NULL THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END IF;
 /* 이미 지운 메모 = 같은 결과(다시 눌러도 안전) */
 SELECT * INTO h FROM crm_security.activity_memo_hidden x WHERE x.activity_id=v_id;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'policy','activity-memo-hide-v1','activity_id',v_id,'deal_id',h.deal_id,'hidden_at',h.hidden_at,'duplicate',true); END IF;
 SELECT * INTO r FROM public.activities x WHERE x.id=v_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '메모를 찾지 못했습니다' USING ERRCODE='P0002'; END IF;
 IF r.type IS DISTINCT FROM '메모' THEN RAISE EXCEPTION '내부 메모만 삭제할 수 있습니다' USING ERRCODE='22023'; END IF;
 IF r.deal_id IS NULL OR NOT crm_security.can_deal(r.deal_id,false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT u.email INTO v_email FROM public.users u WHERE u.user_id=a.user_id;
 IF a.permission_role IS DISTINCT FROM 'admin'
  AND NOT (coalesce(r.actor_email,'')<>'' AND lower(r.actor_email)=lower(coalesce(v_email,'')))
  AND NOT (coalesce(r.actor_name,'')<>'' AND r.actor_name=a.display_name)
 THEN RAISE EXCEPTION '본인이 남긴 메모만 삭제할 수 있습니다' USING ERRCODE='42501'; END IF;
 INSERT INTO crm_security.activity_memo_hidden(activity_id,deal_id,original,author_name,hidden_by_user_id,hidden_by_name)
  VALUES(r.id,r.deal_id,to_jsonb(r),r.actor_name,a.user_id,a.display_name) RETURNING * INTO h;
 BEGIN
  DELETE FROM public.activities x WHERE x.id=v_id;
 EXCEPTION WHEN foreign_key_violation THEN
  RAISE EXCEPTION '다른 기록이 이 메모를 가리키고 있어 삭제할 수 없습니다' USING ERRCODE='23503';
 END;
 /* 색인 정리(색인 표가 없는 DB 에서도 돌게) */
 IF to_regclass('crm_security.activity_context_events') IS NOT NULL THEN EXECUTE 'DELETE FROM crm_security.activity_context_events WHERE activity_id=$1' USING v_id; END IF;
 IF to_regclass('crm_security.activity_links') IS NOT NULL THEN EXECUTE 'DELETE FROM crm_security.activity_links WHERE source_type=''deal'' AND activity_id=$1' USING v_id; END IF;
 RETURN jsonb_build_object('ok',true,'policy','activity-memo-hide-v1','activity_id',v_id,'deal_id',h.deal_id,'hidden_at',h.hidden_at,'duplicate',false);
END $fn$;
REVOKE ALL ON FUNCTION public.crm_activity_memo_hide_v1(jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_activity_memo_hide_v1(jsonb) TO authenticated;

COMMIT;

-- 되살리기(관리자 · 필요할 때만 · <id> 자리에 메모 id):
--   INSERT INTO public.activities SELECT * FROM jsonb_populate_record(NULL::public.activities,(SELECT original FROM crm_security.activity_memo_hidden WHERE activity_id='<id>'));
--   DELETE FROM crm_security.activity_memo_hidden WHERE activity_id='<id>';
