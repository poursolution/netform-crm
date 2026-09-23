-- 되돌리기: 2026-09-24 영업사원 로그인 연결 해제 (이필선·한준엽·정정훈·김성민)
-- auth 계정 자체는 Dashboard에서 별도로 삭제해야 합니다.
BEGIN;
DELETE FROM crm_security.access_review
 WHERE user_id IN (SELECT user_id FROM public.users WHERE name IN ('이필선','한준엽','정정훈','김성민'))
   AND reviewed_by LIKE '%2026-09-24 영업사원 로그인 개설%';
UPDATE public.users SET auth_uid=NULL
 WHERE name IN ('이필선','한준엽','정정훈','김성민')
   AND NOT EXISTS (SELECT 1 FROM crm_security.access_review r WHERE r.user_id=users.user_id);
COMMIT;
SELECT name, auth_uid FROM public.users WHERE name IN ('이필선','한준엽','정정훈','김성민');
