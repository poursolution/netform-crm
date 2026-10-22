-- 하자 사진 간이 접수 v1 (2026-10-22 회의록 10/1 · 10/21 '단일 창구': 외근 담당이 현장에서 받은 하자 사진 1장을 모바일 CRM 에서 바로 접수)
--   · 표 crm_security.defect_reports(접수 1건 = 영업건 + 부위 + 긴급 + 메모 + 사진 경로 + 상태) — 삭제 없음, 상태만 바뀐다.
--   · 사진은 Supabase 저장소 비공개 버킷 'defect-photos'(5MB · jpeg/png/webp). 올리는 사람 = 로그인 사용자(소유자 경로), 읽기는 로그인 사용자.
--   · 접수 명령 crm_defect_report_create_v1 은 같은 거래 안에서 응대 기록(activities, 유형 '하자')에 '[하자] 내용 | 접수 날짜 | 담당 | 약속 없음 | 미해결' 표식을 남긴다
--     → 기존 색인(activity_context_events kind=defect)과 확장관리 '하자 먼저' · PC 상세 하자 칸이 그대로 알아본다. 본사 알림은 화면이 잔디 사건 알림(crm-jandi event)으로.
--   · 목록 crm_defect_report_list_v1: 관리자는 전체, 담당자는 볼 수 있는 영업건만. 다시 실행해도 안전하다. 운영 적용: 대표 Run.
BEGIN;

CREATE TABLE IF NOT EXISTS crm_security.defect_reports(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE,
 deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
 site_id uuid,
 part text NOT NULL CHECK (part IN ('옥상','외벽','지하주차장','배수로','기타')),
 urgent boolean NOT NULL DEFAULT false,
 memo text NOT NULL DEFAULT '' CHECK (length(memo)<=500),
 photo_bucket text NOT NULL DEFAULT 'defect-photos',
 photo_path text CHECK (photo_path IS NULL OR length(photo_path) BETWEEN 1 AND 300),
 status text NOT NULL DEFAULT '접수' CHECK (status IN ('접수','확인','처리중','완료')),
 reporter_user_id uuid NOT NULL,
 reporter_name text NOT NULL,
 activity_id uuid,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS defect_reports_deal_idx ON crm_security.defect_reports(deal_id,created_at DESC);
CREATE INDEX IF NOT EXISTS defect_reports_status_idx ON crm_security.defect_reports(status,created_at DESC);
ALTER TABLE crm_security.defect_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE crm_security.defect_reports FROM PUBLIC,anon,authenticated,service_role;

-- 저장소 버킷 · 정책(저장소가 있는 운영 DB 에서만 — 검사용 DB 에는 storage 가 없다)
DO $do$
BEGIN
 IF to_regclass('storage.buckets') IS NULL THEN RETURN; END IF;
 INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  VALUES('defect-photos','defect-photos',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
  ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=5242880,allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];
 EXECUTE 'DROP POLICY IF EXISTS "defect photos insert" ON storage.objects';
 EXECUTE 'DROP POLICY IF EXISTS "defect photos read" ON storage.objects';
 EXECUTE $p$CREATE POLICY "defect photos insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='defect-photos' AND (storage.foldername(name))[1]=auth.uid()::text)$p$;
 EXECUTE $p$CREATE POLICY "defect photos read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='defect-photos')$p$;
END $do$;

-- ① 접수(담당자 · 지사 · 관리자): 같은 request_id 는 같은 행
CREATE OR REPLACE FUNCTION public.crm_defect_report_create_v1(p jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a record; d public.deals%ROWTYPE; r crm_security.defect_reports%ROWTYPE; v_req uuid; v_deal uuid; v_part text; v_urgent boolean; v_memo text; v_photo text;
 v_owner text; v_note text; v_act uuid; v_email text; v_at timestamptz:=clock_timestamp(); v_day text;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role NOT IN ('rep','branch','admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END IF;
 BEGIN v_req:=(p->>'request_id')::uuid; v_deal:=(p->>'deal_id')::uuid; v_urgent:=coalesce((p->>'urgent')::boolean,false); EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END;
 v_part:=btrim(coalesce(p->>'part','')); v_memo:=btrim(coalesce(p->>'memo','')); v_photo:=nullif(btrim(coalesce(p->>'photo_path','')),'');
 IF v_req IS NULL OR v_deal IS NULL OR v_part NOT IN ('옥상','외벽','지하주차장','배수로','기타') OR length(v_memo)>500
  OR (v_photo IS NOT NULL AND (length(v_photo)>300 OR v_photo !~ '^[A-Za-z0-9._/-]+$' OR v_photo LIKE '%..%'))
 THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END IF;
 IF v_photo IS NULL AND v_memo='' THEN RAISE EXCEPTION '사진이나 내용 중 하나는 있어야 합니다' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM crm_security.defect_reports x WHERE x.request_id=v_req;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'policy','defect-report-v1','id',r.id,'deal_id',r.deal_id,'status',r.status,'activity_id',r.activity_id,'photo_path',r.photo_path,'duplicate',true); END IF;
 SELECT * INTO d FROM public.deals x WHERE x.id=v_deal FOR UPDATE;
 IF NOT FOUND OR NOT crm_security.can_deal(v_deal,false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT u.name INTO v_owner FROM public.users u WHERE u.user_id=d.owner_id;
 v_owner:=coalesce(nullif(v_owner,''),nullif(d.assignee_name,''),a.display_name);
 v_day:=to_char(v_at AT TIME ZONE 'Asia/Seoul','YYYY-MM-DD');
 /* 기존 표식 그대로: '[하자] 내용 | 접수 날짜 | 담당 | 약속 날짜 | 미해결' */
 v_note:='[하자] '||v_part||CASE WHEN v_memo<>'' THEN ' · '||v_memo ELSE '' END||CASE WHEN v_urgent THEN ' · 긴급' ELSE '' END||CASE WHEN v_photo IS NOT NULL THEN ' · 사진 1장' ELSE '' END
  ||' | 접수 '||v_day||' | 담당 '||v_owner||' | 약속 없음 | 미해결';
 SELECT u.email INTO v_email FROM public.users u WHERE u.user_id=a.user_id;
 INSERT INTO public.activities(deal_id,organization_id,actor_email,actor_name,type,detail,occurred_at)
  VALUES(v_deal,d.organization_id,v_email,a.display_name,'하자',jsonb_build_object('note',v_note,'result',v_memo,'meaningful_contact',false,'defect_part',v_part,'defect_urgent',v_urgent,'defect_photo',v_photo),v_at)
  RETURNING id INTO v_act;
 INSERT INTO crm_security.defect_reports(request_id,deal_id,site_id,part,urgent,memo,photo_path,reporter_user_id,reporter_name,activity_id,created_at,updated_at)
  VALUES(v_req,v_deal,d.site_id,v_part,v_urgent,v_memo,v_photo,a.user_id,a.display_name,v_act,v_at,v_at) RETURNING * INTO r;
 UPDATE public.deals SET last_activity_at=GREATEST(coalesce(last_activity_at,v_at),v_at),updated_at=v_at WHERE id=v_deal;
 RETURN jsonb_build_object('ok',true,'policy','defect-report-v1','id',r.id,'deal_id',r.deal_id,'status',r.status,'activity_id',r.activity_id,'photo_path',r.photo_path,'note',v_note,'at',v_at,'duplicate',false);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_defect_report_create_v1(jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_defect_report_create_v1(jsonb) TO authenticated;

-- ② 목록: 관리자 전체 · 담당자는 볼 수 있는 영업건만 · 상태 · 영업건 필터
CREATE OR REPLACE FUNCTION public.crm_defect_report_list_v1(p jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a record; v_deal uuid; v_status text; v_limit integer;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 BEGIN v_deal:=nullif(p->>'deal_id','')::uuid; EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END;
 v_status:=nullif(btrim(coalesce(p->>'status','')),''); v_limit:=LEAST(GREATEST(coalesce((p->>'limit')::integer,100),1),500);
 RETURN jsonb_build_object('ok',true,'policy','defect-report-v1','items',coalesce((
  SELECT jsonb_agg(jsonb_build_object('id',r.id,'deal_id',r.deal_id,'site_id',r.site_id,'site_name',coalesce(s.site_name,d.assignee_name,''),'part',r.part,'urgent',r.urgent,'memo',r.memo,
   'photo_bucket',r.photo_bucket,'photo_path',r.photo_path,'status',r.status,'reporter_name',r.reporter_name,'activity_id',r.activity_id,'created_at',r.created_at,'updated_at',r.updated_at) ORDER BY r.created_at DESC)
  FROM (SELECT * FROM crm_security.defect_reports x WHERE (v_deal IS NULL OR x.deal_id=v_deal) AND (v_status IS NULL OR x.status=v_status) AND crm_security.can_deal(x.deal_id,false) ORDER BY x.created_at DESC LIMIT v_limit) r
  LEFT JOIN public.deals d ON d.id=r.deal_id LEFT JOIN public.sites s ON s.site_id=d.site_id),'[]'::jsonb));
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_defect_report_list_v1(jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_defect_report_list_v1(jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';

COMMIT;
