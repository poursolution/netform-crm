-- 직원 계정 관리 v2 (2026-10-05 design_handoff_accounts · 대표 "직원 계정 관리 창만 이 디자인으로")
-- 관리자가 CRM 안에서 ① 계정 추가 ② 로그인 미연결 직원(경남지사 · 조재연 등)의 계정 연결 ③ 비밀번호 재설정(임시 비밀번호) ④ 퇴사자 비활성화를 한다.
--   · 실행은 전부 admin 권한만(crm_security.actor() 로 다시 확인). 본인 계정은 재설정 · 비활성화하지 않는다(본인은 '비밀번호 변경' 사용).
--   · 임시 비밀번호를 내준 계정은 '바꿔야 함' 표시가 붙고, 그 사람이 로그인하면 화면이 비밀번호 변경을 먼저 띄운다. 실제로 비밀번호가 바뀌어야(저장된 값이 달라져야) 표시가 풀린다.
--   · 재설정 · 비활성화는 대상의 로그인(세션 · 갱신 토큰)을 바로 지운다. 비활성화는 권한 확인(actor)에서 그 즉시 막히고 다시 로그인도 못 한다(banned_until).
--     재설정은 이미 열려 있는 화면의 접속 토큰이 만료될 때(최대 1시간)까지는 이어질 수 있다 — 2026-09-24 재설정과 같은 동작. 삭제는 하지 않는다 — 기록 · 실적 귀속은 그대로 남는다.
--   · 모든 일은 crm_security.credential_events 에 남는다(누가 · 언제 · 대상 · 무엇을).
--   · 새 계정의 권한: 영업사원 · 팀장 = rep / 지사 = branch(경남지사 화면 · 요청 업무의 '지사' 대상) / 관리자 · 대표 겸직 = admin. 권한 승인(access_review)을 이 함수가 같이 만든다.
--   · 로그인 계정(auth.users · auth.identities)은 운영에 있는 기존 계정과 같은 모양으로 만든다(2026-10-05 읽기 전용 확인: 이메일 로그인 · 확인 완료 · 토큰 칸은 빈 문자열).
-- 새 표 2개(crm_security.credential_state · account_profile) + 함수 6개(기존 2개 교체 포함). 다시 실행해도 안전하다.
BEGIN;

-- 이력 종류 넓히기(기존: password_reset 만)
DO $do$
DECLARE c record;
BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='crm_security.credential_events'::regclass AND contype='c' LOOP
  EXECUTE format('ALTER TABLE crm_security.credential_events DROP CONSTRAINT %I',c.conname);
 END LOOP;
 ALTER TABLE crm_security.credential_events ADD CONSTRAINT credential_events_action_check
  CHECK(action IN('password_reset','account_created','account_linked','deactivated','reactivated','password_changed'));
END $do$;

-- 임시 비밀번호 상태: 바꿔야 함 표시 + 내줄 때의 저장값(실제로 바뀌었는지 비교용)
CREATE TABLE IF NOT EXISTS crm_security.credential_state(
 user_id uuid PRIMARY KEY REFERENCES public.users(user_id),
 must_change boolean NOT NULL DEFAULT false,
 temp_hash text,
 temp_issued_at timestamptz,
 temp_issued_by uuid,
 changed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_security.credential_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE crm_security.credential_state FROM PUBLIC,anon,authenticated,service_role;

-- 계정 표시 정보: 역할 꼬리표(영업사원 · 팀장 · 지사 · 관리자 · 대표 겸직) · 소속
CREATE TABLE IF NOT EXISTS crm_security.account_profile(
 user_id uuid PRIMARY KEY REFERENCES public.users(user_id),
 kind text NOT NULL CHECK(kind IN('rep','lead','branch','admin','dual')),
 team text,
 updated_by uuid,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_security.account_profile ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE crm_security.account_profile FROM PUBLIC,anon,authenticated,service_role;

-- ① 비밀번호 재설정(기존 함수 교체 · 같은 이름 · 같은 인자): 임시 비밀번호 저장 + 로그인 끊기 + 이력 + '바꿔야 함' 표시
CREATE OR REPLACE FUNCTION public.crm_admin_reset_password_v1(p_target_user_id uuid,p_new_password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a record; t record; v_hash text; v_at timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role<>'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_target_user_id IS NULL OR length(coalesce(p_new_password,''))<8 OR length(p_new_password)>72
 THEN RAISE EXCEPTION 'invalid new password' USING ERRCODE='22023'; END IF;
 SELECT u.user_id,u.name,u.auth_uid,u.active INTO t FROM public.users u WHERE u.user_id=p_target_user_id;
 IF NOT FOUND OR t.auth_uid IS NULL OR NOT t.active THEN RAISE EXCEPTION 'target not eligible' USING ERRCODE='22023'; END IF;
 IF t.user_id=a.user_id THEN RAISE EXCEPTION 'use self password change' USING ERRCODE='22023'; END IF;
 v_hash:=extensions.crypt(p_new_password,extensions.gen_salt('bf',10));
 UPDATE auth.users SET encrypted_password=v_hash,updated_at=v_at WHERE id=t.auth_uid;
 DELETE FROM auth.sessions WHERE user_id=t.auth_uid;
 DELETE FROM auth.refresh_tokens WHERE user_id=t.auth_uid::text;
 INSERT INTO crm_security.credential_state AS s(user_id,must_change,temp_hash,temp_issued_at,temp_issued_by,updated_at)
  VALUES(t.user_id,true,v_hash,v_at,a.user_id,v_at)
  ON CONFLICT (user_id) DO UPDATE SET must_change=true,temp_hash=excluded.temp_hash,temp_issued_at=excluded.temp_issued_at,temp_issued_by=excluded.temp_issued_by,updated_at=excluded.updated_at;
 INSERT INTO crm_security.credential_events(actor_user_id,actor_name,target_user_id,target_name,action)
 VALUES(a.user_id,a.display_name,t.user_id,t.name,'password_reset');
 RETURN jsonb_build_object('ok',true,'policy','admin-password-reset-v1','target_user_id',t.user_id,'target_name',t.name,'at',v_at,'must_change',true);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_admin_reset_password_v1(uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_admin_reset_password_v1(uuid,text) TO authenticated;

-- ② 계정 목록(기존 함수 교체): 권한 · 역할 꼬리표 · 소속 · 임시 비밀번호 사용 중 여부를 더한다
CREATE OR REPLACE FUNCTION public.crm_admin_list_accounts_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a record;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role<>'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('ok',true,'policy','admin-accounts-v1','items',coalesce((
  SELECT jsonb_agg(jsonb_build_object(
   'user_id',u.user_id,'name',u.name,'role',u.role,'active',u.active,
   'email',au.email,'linked',u.auth_uid IS NOT NULL,'last_sign_in_at',au.last_sign_in_at,
   'self',u.user_id=a.user_id,
   'permission_role',(SELECT r.permission_role FROM crm_security.access_review r WHERE r.user_id=u.user_id AND r.approved AND r.expires_at>now()),
   'kind',pf.kind,'team',pf.team,'created_at',u.created_at,
   'must_change',coalesce(s.must_change AND au.encrypted_password IS NOT DISTINCT FROM s.temp_hash,false),'temp_issued_at',s.temp_issued_at)
   ORDER BY u.active DESC,u.created_at,u.name)
  FROM public.users u LEFT JOIN auth.users au ON au.id=u.auth_uid
   LEFT JOIN crm_security.account_profile pf ON pf.user_id=u.user_id
   LEFT JOIN crm_security.credential_state s ON s.user_id=u.user_id),'[]'::jsonb));
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_admin_list_accounts_v1() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_admin_list_accounts_v1() TO authenticated;

-- ③ 계정 추가 / 계정 연결: 로그인 계정 + 직원 줄 + 권한 승인 + '바꿔야 함' 표시 + 이력을 한 번에(하나라도 실패하면 전부 취소)
--    link_user_id 를 주면 이미 있는 직원 줄(로그인 미연결 · 활성)에 로그인만 붙인다 — 이름은 바꾸지 않는다(담당 기록이 이름으로 이어져 있다)
CREATE OR REPLACE FUNCTION public.crm_admin_create_account_v1(p jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a record; t record; v_name text; v_email text; v_kind text; v_team text; v_pw text; v_link uuid; v_role text; v_perm text;
 v_uid uuid:=gen_random_uuid(); v_user uuid; v_hash text; v_at timestamptz:=clock_timestamp(); v_linked boolean:=false;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role<>'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END IF;
 v_name:=nullif(btrim(coalesce(p->>'name','')),''); v_email:=lower(nullif(btrim(coalesce(p->>'email','')),''));
 v_kind:=p->>'kind'; v_team:=nullif(btrim(coalesce(p->>'team','')),''); v_pw:=p->>'temp_password';
 BEGIN v_link:=nullif(p->>'link_user_id','')::uuid; EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END;
 IF v_name IS NULL OR length(v_name)>40 OR v_email IS NULL OR length(v_email)>120 OR v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
  OR v_kind IS NULL OR v_kind NOT IN('rep','lead','branch','admin','dual') OR length(coalesce(v_team,''))>40
 THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END IF;
 IF length(coalesce(v_pw,''))<8 OR length(v_pw)>72 OR v_pw ~ '^[+0-9[:space:]()-]+$' THEN RAISE EXCEPTION 'invalid new password' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users au WHERE lower(au.email)=v_email) THEN RAISE EXCEPTION 'email already used' USING ERRCODE='23505'; END IF;
 v_role:=CASE v_kind WHEN 'admin' THEN 'admin' WHEN 'dual' THEN 'dual' ELSE 'rep' END;
 v_perm:=CASE v_kind WHEN 'admin' THEN 'admin' WHEN 'dual' THEN 'admin' WHEN 'branch' THEN 'branch' ELSE 'rep' END;
 IF v_link IS NOT NULL THEN
  SELECT u.user_id,u.name,u.auth_uid,u.active INTO t FROM public.users u WHERE u.user_id=v_link FOR UPDATE;
  IF NOT FOUND OR t.auth_uid IS NOT NULL OR NOT t.active THEN RAISE EXCEPTION 'target not eligible' USING ERRCODE='22023'; END IF;
  v_user:=t.user_id; v_name:=t.name; v_linked:=true;
 ELSE
  IF EXISTS(SELECT 1 FROM public.users u WHERE u.name=v_name) THEN RAISE EXCEPTION 'name already used' USING ERRCODE='23505'; END IF;
  v_user:=gen_random_uuid();
 END IF;
 v_hash:=extensions.crypt(v_pw,extensions.gen_salt('bf',10));
 INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
   confirmation_token,recovery_token,email_change_token_new,email_change,is_sso_user,is_anonymous)
  VALUES(v_uid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',v_email,v_hash,v_at,
   '{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('name',v_name,'email_verified',true),v_at,v_at,'','','','',false,false);
 INSERT INTO auth.identities(user_id,provider_id,provider,identity_data,created_at,updated_at)
  VALUES(v_uid,v_uid::text,'email',jsonb_build_object('sub',v_uid::text,'email',v_email,'email_verified',true),v_at,v_at);
 IF v_linked THEN
  UPDATE public.users u SET auth_uid=v_uid,email=v_email,role=v_role,updated_at=v_at WHERE u.user_id=v_user;
 ELSE
  INSERT INTO public.users(user_id,name,email,role,active,auth_uid,created_at,updated_at) VALUES(v_user,v_name,v_email,v_role,true,v_uid,v_at,v_at);
 END IF;
 INSERT INTO crm_security.access_review AS r(user_id,reviewed_auth_uid,source_role,permission_role,approved,reviewed_by,reviewed_at,expires_at)
  VALUES(v_user,v_uid,v_role,v_perm,true,'account-admin:'||a.display_name,v_at,'infinity')
  ON CONFLICT (user_id) DO UPDATE SET reviewed_auth_uid=excluded.reviewed_auth_uid,source_role=excluded.source_role,permission_role=excluded.permission_role,
   approved=true,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,expires_at=excluded.expires_at;
 INSERT INTO crm_security.credential_state AS s(user_id,must_change,temp_hash,temp_issued_at,temp_issued_by,updated_at)
  VALUES(v_user,true,v_hash,v_at,a.user_id,v_at)
  ON CONFLICT (user_id) DO UPDATE SET must_change=true,temp_hash=excluded.temp_hash,temp_issued_at=excluded.temp_issued_at,temp_issued_by=excluded.temp_issued_by,updated_at=excluded.updated_at;
 INSERT INTO crm_security.account_profile AS f(user_id,kind,team,updated_by,updated_at) VALUES(v_user,v_kind,v_team,a.user_id,v_at)
  ON CONFLICT (user_id) DO UPDATE SET kind=excluded.kind,team=excluded.team,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 INSERT INTO crm_security.credential_events(actor_user_id,actor_name,target_user_id,target_name,action)
  VALUES(a.user_id,a.display_name,v_user,v_name,CASE WHEN v_linked THEN 'account_linked' ELSE 'account_created' END);
 RETURN jsonb_build_object('ok',true,'policy','admin-account-create-v1','user_id',v_user,'name',v_name,'email',v_email,'kind',v_kind,'linked',v_linked,'must_change',true,'at',v_at);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_admin_create_account_v1(jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_admin_create_account_v1(jsonb) TO authenticated;

-- ④ 비활성화 / 다시 활성화: 삭제하지 않는다. 비활성화 = 로그인 끊기 + 로그인 막기(기록 · 실적 귀속은 그대로)
CREATE OR REPLACE FUNCTION public.crm_admin_set_active_v1(p jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a record; t record; v_id uuid; v_active boolean; v_at timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role<>'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 BEGIN v_id:=(p->>'user_id')::uuid; v_active:=(p->>'active')::boolean; EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END;
 IF v_id IS NULL OR v_active IS NULL THEN RAISE EXCEPTION 'invalid payload' USING ERRCODE='22023'; END IF;
 SELECT u.user_id,u.name,u.auth_uid,u.active INTO t FROM public.users u WHERE u.user_id=v_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'target not eligible' USING ERRCODE='22023'; END IF;
 IF t.user_id=a.user_id THEN RAISE EXCEPTION 'cannot change own account' USING ERRCODE='22023'; END IF;
 IF t.active=v_active THEN
  RETURN jsonb_build_object('ok',true,'policy','admin-account-active-v1','user_id',t.user_id,'name',t.name,'active',t.active,'already',true);
 END IF;
 UPDATE public.users u SET active=v_active,updated_at=v_at WHERE u.user_id=t.user_id;
 IF t.auth_uid IS NOT NULL THEN
  IF v_active THEN
   UPDATE auth.users SET banned_until=NULL,updated_at=v_at WHERE id=t.auth_uid;
  ELSE
   /* 끝없는 날짜(infinity)는 로그인 서버가 읽다가 오류를 낼 수 있어 100년 뒤로 적는다 */
   UPDATE auth.users SET banned_until=v_at+interval '100 years',updated_at=v_at WHERE id=t.auth_uid;
   DELETE FROM auth.sessions WHERE user_id=t.auth_uid;
   DELETE FROM auth.refresh_tokens WHERE user_id=t.auth_uid::text;
  END IF;
 END IF;
 INSERT INTO crm_security.credential_events(actor_user_id,actor_name,target_user_id,target_name,action)
  VALUES(a.user_id,a.display_name,t.user_id,t.name,CASE WHEN v_active THEN 'reactivated' ELSE 'deactivated' END);
 RETURN jsonb_build_object('ok',true,'policy','admin-account-active-v1','user_id',t.user_id,'name',t.name,'active',v_active,'at',v_at);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_admin_set_active_v1(jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_admin_set_active_v1(jsonb) TO authenticated;

-- ⑤ 내 계정: 임시 비밀번호를 아직 쓰고 있는가(로그인 직후 화면이 묻는다). 이미 바꿨으면 표시를 풀어 준다
CREATE OR REPLACE FUNCTION public.crm_my_credential_state_v1()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a record; s record; v_now_hash text; v_at timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT c.must_change,c.temp_hash,c.temp_issued_at INTO s FROM crm_security.credential_state c WHERE c.user_id=a.user_id;
 IF NOT FOUND OR NOT s.must_change THEN RETURN jsonb_build_object('ok',true,'must_change',false); END IF;
 SELECT au.encrypted_password INTO v_now_hash FROM auth.users au WHERE au.id=a.auth_uid;
 IF v_now_hash IS DISTINCT FROM s.temp_hash THEN
  UPDATE crm_security.credential_state c SET must_change=false,temp_hash=NULL,changed_at=v_at,updated_at=v_at WHERE c.user_id=a.user_id;
  INSERT INTO crm_security.credential_events(actor_user_id,actor_name,target_user_id,target_name,action) VALUES(a.user_id,a.display_name,a.user_id,a.display_name,'password_changed');
  RETURN jsonb_build_object('ok',true,'must_change',false,'cleared',true);
 END IF;
 RETURN jsonb_build_object('ok',true,'must_change',true,'temp_issued_at',s.temp_issued_at);
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_my_credential_state_v1() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_my_credential_state_v1() TO authenticated;

COMMIT;
