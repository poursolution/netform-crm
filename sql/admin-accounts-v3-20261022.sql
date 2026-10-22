-- 직원 계정 관리 v3 (2026-10-22 회의록 10/1 '관리자 계정 제어': 신규 입사자 · 외부 영업이사를 관리자가 CRM 안에서 빠르게 등록 · 정리)
-- v2(sql/admin-accounts-v2-20261005.sql: 추가 · 연결 · 재설정 · 비활성) 위에 두 가지를 더한다. 다시 실행해도 안전하다. 삭제는 여전히 하지 않는다.
--   ① 역할 · 소속 변경(crm_admin_set_role_v1): 이미 있는 직원의 역할 꼬리표(영업사원 · 팀장 · 지사 · 관리자 · 대표 겸직) · 소속을 바꾼다.
--      권한(access_review.permission_role) · users.role 도 같이 바뀌어 서버 권한 확인(actor)에 바로 반영된다. 관리자 권한을 내리면 그 사람의 로그인을 끊는다(다시 로그인하면 새 권한).
--      본인 계정은 바꾸지 않는다. 이력 role_changed.
--   ② 외부 영업이사 명단(crm_security.sales_directors) 관리: 목록(crm_admin_director_list_v1) · 추가 · 활성 · 비활성(crm_admin_director_set_v1).
--      영업이사는 로그인 계정 없이 '이름으로 배정'되는 사람(crm_inquiry_director_assign_v1 의 대상). 직원 이름과 같은 이름은 막는다(배정 이름이 섞이지 않게).
--      이력은 crm_security.director_events 에 남는다(누가 · 언제 · 누구를 · 무엇을).
BEGIN;

-- 이력 종류 넓히기(v2: 6종 → +role_changed)
DO $do$
DECLARE c record;
BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='crm_security.credential_events'::regclass AND contype='c' LOOP
  EXECUTE format('ALTER TABLE crm_security.credential_events DROP CONSTRAINT %I',c.conname);
 END LOOP;
 ALTER TABLE crm_security.credential_events ADD CONSTRAINT credential_events_action_check
  CHECK(action IN('password_reset','account_created','account_linked','deactivated','reactivated','password_changed','role_changed'));
END $do$;

-- 영업이사 명단: 누가 언제 바꿨는지 · 메모(소속 · 연락 경로 등 짧은 글)
CREATE TABLE IF NOT EXISTS crm_security.sales_directors(
  name text PRIMARY KEY CHECK (length(btrim(name)) BETWEEN 1 AND 40),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_security.sales_directors ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE crm_security.sales_directors ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE crm_security.sales_directors ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
REVOKE ALL ON TABLE crm_security.sales_directors FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS crm_security.director_events(
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_user_id uuid NOT NULL,
 actor_name text NOT NULL,
 director_name text NOT NULL,
 action text NOT NULL CHECK(action IN('added','activated','deactivated','noted')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_security.director_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE crm_security.director_events FROM PUBLIC,anon,authenticated,service_role;

-- ① 역할 · 소속 변경
CREATE OR REPLACE FUNCTION public.crm_admin_set_role_v1(p jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a record; t record; v_id uuid; v_kind text; v_team text; v_role text; v_perm text; v_old_perm text; v_at timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role<>'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END IF;
 BEGIN v_id:=(p->>'user_id')::uuid; EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END;
 v_kind:=p->>'kind'; v_team:=nullif(btrim(coalesce(p->>'team','')),'');
 IF v_id IS NULL OR v_kind IS NULL OR v_kind NOT IN('rep','lead','branch','admin','dual') OR length(coalesce(v_team,''))>40
 THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END IF;
 SELECT u.user_id,u.name,u.auth_uid,u.active,u.role INTO t FROM public.users u WHERE u.user_id=v_id FOR UPDATE;
 IF NOT FOUND OR NOT t.active THEN RAISE EXCEPTION 'target not eligible' USING ERRCODE='22023'; END IF;
 IF t.user_id=a.user_id THEN RAISE EXCEPTION 'cannot change own account' USING ERRCODE='22023'; END IF;
 v_role:=CASE v_kind WHEN 'admin' THEN 'admin' WHEN 'dual' THEN 'dual' ELSE 'rep' END;
 v_perm:=CASE v_kind WHEN 'admin' THEN 'admin' WHEN 'dual' THEN 'admin' WHEN 'branch' THEN 'branch' ELSE 'rep' END;
 SELECT r.permission_role INTO v_old_perm FROM crm_security.access_review r WHERE r.user_id=t.user_id;
 UPDATE public.users u SET role=v_role,updated_at=v_at WHERE u.user_id=t.user_id;
 IF t.auth_uid IS NOT NULL THEN
  INSERT INTO crm_security.access_review AS r(user_id,reviewed_auth_uid,source_role,permission_role,approved,reviewed_by,reviewed_at,expires_at)
   VALUES(t.user_id,t.auth_uid,v_role,v_perm,true,'account-admin:'||a.display_name,v_at,'infinity')
   ON CONFLICT (user_id) DO UPDATE SET reviewed_auth_uid=excluded.reviewed_auth_uid,source_role=excluded.source_role,permission_role=excluded.permission_role,
    approved=true,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,expires_at=excluded.expires_at;
  /* 권한을 내리면(관리자 → 그 밖) 지금 로그인을 끊는다 — 열려 있는 관리자 화면이 그대로 남지 않게 */
  IF v_old_perm='admin' AND v_perm<>'admin' THEN
   DELETE FROM auth.sessions WHERE user_id=t.auth_uid;
   DELETE FROM auth.refresh_tokens WHERE user_id=t.auth_uid::text;
  END IF;
 END IF;
 INSERT INTO crm_security.account_profile AS f(user_id,kind,team,updated_by,updated_at) VALUES(t.user_id,v_kind,v_team,a.user_id,v_at)
  ON CONFLICT (user_id) DO UPDATE SET kind=excluded.kind,team=excluded.team,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 INSERT INTO crm_security.credential_events(actor_user_id,actor_name,target_user_id,target_name,action)
  VALUES(a.user_id,a.display_name,t.user_id,t.name,'role_changed');
 RETURN jsonb_build_object('ok',true,'policy','admin-account-role-v1','user_id',t.user_id,'name',t.name,'kind',v_kind,'team',v_team,'role',v_role,
  'permission_role',CASE WHEN t.auth_uid IS NULL THEN NULL ELSE v_perm END,'session_cleared',(t.auth_uid IS NOT NULL AND v_old_perm='admin' AND v_perm<>'admin'),'at',v_at);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_admin_set_role_v1(jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_admin_set_role_v1(jsonb) TO authenticated;

-- ② 영업이사 목록
CREATE OR REPLACE FUNCTION public.crm_admin_director_list_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a record;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role<>'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('ok',true,'policy','admin-directors-v1','items',coalesce((
  SELECT jsonb_agg(jsonb_build_object('name',d.name,'active',d.active,'note',d.note,'created_at',d.created_at,'updated_at',d.updated_at,
   'assigned_open',(SELECT count(*) FROM public.inquiries i WHERE i.assignee_name=d.name AND i.assigned_to IS NULL AND coalesce(i.status,'') !~ '^(종결|실주|배드핏|상담 종결|Bad Fit)'))
   ORDER BY d.active DESC,d.created_at,d.name)
  FROM crm_security.sales_directors d),'[]'::jsonb));
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_admin_director_list_v1() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_admin_director_list_v1() TO authenticated;

-- ② 영업이사 추가 · 활성 · 비활성 · 메모(이름이 열쇠 — 바꾸지 않는다. 삭제하지 않는다)
CREATE OR REPLACE FUNCTION public.crm_admin_director_set_v1(p jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a record; d record; v_name text; v_active boolean; v_note text; v_action text; v_at timestamptz:=clock_timestamp(); v_created boolean:=false;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role<>'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END IF;
 v_name:=nullif(btrim(coalesce(p->>'name','')),'');
 BEGIN v_active:=coalesce((p->>'active')::boolean,true); EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END;
 v_note:=nullif(btrim(coalesce(p->>'note','')),'');
 IF v_name IS NULL OR length(v_name)>40 OR length(coalesce(v_note,''))>120 THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END IF;
 SELECT * INTO d FROM crm_security.sales_directors s WHERE s.name=v_name FOR UPDATE;
 IF NOT FOUND THEN
  IF EXISTS(SELECT 1 FROM public.users u WHERE u.name=v_name) THEN RAISE EXCEPTION 'name already used' USING ERRCODE='23505'; END IF;
  INSERT INTO crm_security.sales_directors(name,active,note,updated_by,updated_at,created_at) VALUES(v_name,v_active,v_note,a.user_id,v_at,v_at);
  v_created:=true; v_action:='added';
 ELSE
  IF d.active=v_active AND d.note IS NOT DISTINCT FROM coalesce(v_note,d.note) THEN
   RETURN jsonb_build_object('ok',true,'policy','admin-director-set-v1','name',d.name,'active',d.active,'note',d.note,'already',true);
  END IF;
  v_action:=CASE WHEN d.active<>v_active THEN (CASE WHEN v_active THEN 'activated' ELSE 'deactivated' END) ELSE 'noted' END;
  UPDATE crm_security.sales_directors s SET active=v_active,note=coalesce(v_note,s.note),updated_by=a.user_id,updated_at=v_at WHERE s.name=v_name;
 END IF;
 INSERT INTO crm_security.director_events(actor_user_id,actor_name,director_name,action) VALUES(a.user_id,a.display_name,v_name,v_action);
 RETURN jsonb_build_object('ok',true,'policy','admin-director-set-v1','name',v_name,'active',v_active,'note',coalesce(v_note,d.note),'created',v_created,'action',v_action,'at',v_at);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_admin_director_set_v1(jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_admin_director_set_v1(jsonb) TO authenticated;

COMMIT;
