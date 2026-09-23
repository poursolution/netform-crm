-- 영업사원 로그인 연결: 이필선 · 한준엽 · 정정훈 · 김성민 (2026-09-24)
--
-- 실행 전 준비 (Supabase Dashboard → Authentication → Users → Add user):
--   4명의 이메일/비밀번호로 auth 계정을 먼저 만들고 "Auto Confirm User"를 켠다.
--   그 다음 아래 mapping의 이메일 4개를 실제 생성한 이메일로 바꾸고 SQL Editor에서 실행.
--
-- 하는 일:
--   1) public.users에서 이름으로 해당 사원을 찾아 auth_uid를 연결 (이미 연결된 사람은 건드리지 않고 실패)
--   2) role을 'rep'로 확인 (다르면 실패 — 임의 변경하지 않음)
--   3) crm_security.access_review에 승인 행 upsert (permission_role='rep', 1년 유효)
--   4) 결과 검증 출력
--
-- 되돌리기: 같은 폴더의 20260924_rep_logins_rollback.sql

DO $$
DECLARE
 m record; v_auth uuid; v_user uuid; v_role text; v_cnt int;
BEGIN
 FOR m IN
  SELECT * FROM (VALUES
   ('이필선','REPLACE-pilseon@example.com'),
   ('한준엽','REPLACE-junyeop@example.com'),
   ('정정훈','REPLACE-jeonghun@example.com'),
   ('김성민','REPLACE-seongmin@example.com')
  ) AS t(name,email)
 LOOP
  -- auth 계정 확인
  SELECT id INTO v_auth FROM auth.users WHERE lower(email)=lower(m.email);
  IF v_auth IS NULL THEN RAISE EXCEPTION '[%] auth 계정이 없습니다: % — Dashboard에서 먼저 생성하세요', m.name, m.email; END IF;

  -- 대상 사원 확인 (이름 유일, 미연결)
  SELECT count(*) INTO v_cnt FROM public.users WHERE name=m.name;
  IF v_cnt<>1 THEN RAISE EXCEPTION '[%] public.users에서 이름이 %건 조회됨 (1건이어야 함)', m.name, v_cnt; END IF;
  SELECT user_id, role INTO v_user, v_role FROM public.users WHERE name=m.name;
  IF EXISTS(SELECT 1 FROM public.users WHERE name=m.name AND auth_uid IS NOT NULL AND auth_uid<>v_auth)
  THEN RAISE EXCEPTION '[%] 이미 다른 auth 계정이 연결되어 있습니다 — 수동 확인 필요', m.name; END IF;
  IF v_role<>'rep' THEN RAISE EXCEPTION '[%] role이 rep이 아니라 % 입니다 — 정책 확인 후 별도 처리', m.name, v_role; END IF;
  IF EXISTS(SELECT 1 FROM public.users WHERE auth_uid=v_auth AND name<>m.name)
  THEN RAISE EXCEPTION '[%] 해당 auth 계정이 다른 사원에 연결되어 있습니다', m.name; END IF;

  -- 연결 + 승인
  UPDATE public.users SET auth_uid=v_auth, active=true WHERE user_id=v_user;
  INSERT INTO crm_security.access_review(user_id,reviewed_auth_uid,source_role,permission_role,approved,reviewed_by,expires_at)
  VALUES (v_user,v_auth,'rep','rep',true,'넷폼알앤디 대표 승인(2026-09-24 영업사원 로그인 개설)',now()+interval '1 year')
  ON CONFLICT (user_id) DO UPDATE
   SET reviewed_auth_uid=EXCLUDED.reviewed_auth_uid, source_role='rep', permission_role='rep',
       approved=true, reviewed_by=EXCLUDED.reviewed_by, reviewed_at=now(), expires_at=EXCLUDED.expires_at;

  RAISE NOTICE '[%] 연결 완료: auth % → user %', m.name, v_auth, v_user;
 END LOOP;
END $$;

-- 검증: 4명이 모두 approved rep으로 연결됐는지
SELECT u.name, u.role, (u.auth_uid IS NOT NULL) AS auth_linked,
       r.permission_role, r.approved, r.expires_at::date
FROM public.users u
LEFT JOIN crm_security.access_review r ON r.user_id=u.user_id
WHERE u.name IN ('이필선','한준엽','정정훈','김성민')
ORDER BY u.name;
