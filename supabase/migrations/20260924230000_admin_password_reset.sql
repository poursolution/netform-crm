-- 관리자 계정 관리 v1 (2026-09-24): 관리자가 CRM에서 직원 비밀번호를 재설정하고 계정 상태를 조회한다.
-- 원칙: admin permission_role만 실행, 본인 비밀번호는 셀프 변경 사용, 모든 재설정은 감사 로그에 남기고
--       대상의 기존 로그인 세션·리프레시 토큰을 즉시 무효화한다.
BEGIN;

CREATE TABLE IF NOT EXISTS crm_security.credential_events(
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_user_id uuid NOT NULL,
 actor_name text NOT NULL,
 target_user_id uuid NOT NULL,
 target_name text NOT NULL,
 action text NOT NULL CHECK(action IN('password_reset')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE crm_security.credential_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE crm_security.credential_events FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.crm_admin_reset_password_v1(p_target_user_id uuid,p_new_password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE a record; t record;
BEGIN
 SELECT * INTO a FROM crm_security.actor();
 IF NOT FOUND OR a.permission_role<>'admin' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_target_user_id IS NULL OR length(coalesce(p_new_password,''))<8 OR length(p_new_password)>72
 THEN RAISE EXCEPTION 'invalid new password' USING ERRCODE='22023'; END IF;
 SELECT u.user_id,u.name,u.auth_uid,u.active INTO t FROM public.users u WHERE u.user_id=p_target_user_id;
 IF NOT FOUND OR t.auth_uid IS NULL OR NOT t.active THEN RAISE EXCEPTION 'target not eligible' USING ERRCODE='22023'; END IF;
 IF t.user_id=a.user_id THEN RAISE EXCEPTION 'use self password change' USING ERRCODE='22023'; END IF;
 UPDATE auth.users SET encrypted_password=extensions.crypt(p_new_password,extensions.gen_salt('bf')),updated_at=now()
  WHERE id=t.auth_uid;
 DELETE FROM auth.sessions WHERE user_id=t.auth_uid;
 DELETE FROM auth.refresh_tokens WHERE user_id=t.auth_uid::text;
 INSERT INTO crm_security.credential_events(actor_user_id,actor_name,target_user_id,target_name,action)
 VALUES(a.user_id,a.display_name,t.user_id,t.name,'password_reset');
 RETURN jsonb_build_object('ok',true,'policy','admin-password-reset-v1','target_user_id',t.user_id,'target_name',t.name,'at',now());
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_admin_reset_password_v1(uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_admin_reset_password_v1(uuid,text) TO authenticated;

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
   'self',u.user_id=a.user_id) ORDER BY u.active DESC,u.name)
  FROM public.users u LEFT JOIN auth.users au ON au.id=u.auth_uid),'[]'::jsonb));
END $fn$;
REVOKE EXECUTE ON FUNCTION public.crm_admin_list_accounts_v1() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.crm_admin_list_accounts_v1() TO authenticated;

COMMIT;
