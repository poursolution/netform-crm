-- 되돌리기: sql/inquiry-external-kind-b2b-v1-20261112.sql 이 덧붙인 줄(표시 inquiry_external_kind_v1)만 빼서 네 함수를 원래 본문으로.
-- 이미 바뀐 문의의 work_type · raw 문의성격은 그대로 둔다(되돌릴 땐 감사 기록 flow_field_set · field inquiry_kind 의 before_data 로 확인).
-- 새 함수 3개는 남아도 무해(아무도 안 부름). 지우려면 맨 아래 주석을 푼다.
DO $rollback$
DECLARE
 targets text[]:=ARRAY['public.crm_inquiry_change_enqueue_v1(jsonb)','public.crm_inquiry_change_apply_v1(text)',
  'private.inquiry_external_promote_v1(uuid,text)','private.inquiry_external_promote_v2(uuid,text,text)'];
 added text[]:=ARRAY[
  $a$perform private.inquiry_external_kind_validate_v1(p_event); /* inquiry_external_kind_v1 */ $a$,
  $a$perform private.inquiry_external_kind_apply_v1(i.id,p,p_event_id,source_at); /* inquiry_external_kind_v1 */ $a$,
  $a$ IF private.inquiry_is_b2b_v1(q.id) THEN RETURN jsonb_build_object('ok',true,'reason','B2B_NO_PIPELINE'); END IF; /* inquiry_external_kind_v1 */$a$,
  $a$ IF private.inquiry_is_b2b_v1(q.id) THEN RETURN jsonb_build_object('ok',true,'reason','B2B_NO_PIPELINE'); END IF; /* inquiry_external_kind_v1 */$a$];
 target regprocedure; d text; acl aclitem[]; cfg text[]; sec boolean; k integer; n integer;
BEGIN
 FOR k IN 1..4 LOOP
  target:=targets[k]::regprocedure;
  SELECT pg_get_functiondef(target),proacl,proconfig,prosecdef INTO d,acl,cfg,sec FROM pg_proc WHERE oid=target;
  IF position('inquiry_external_kind_v1' in d)=0 THEN CONTINUE; END IF;
  n:=(length(d)-length(replace(d,added[k],'')))/length(added[k]);
  IF n<>1 THEN RAISE EXCEPTION 'rollback text for % found % times; review',targets[k],n; END IF;
  EXECUTE replace(d,added[k],'');
  IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=target AND (proacl IS DISTINCT FROM acl OR proconfig IS DISTINCT FROM cfg OR prosecdef IS DISTINCT FROM sec))
  THEN RAISE EXCEPTION 'Security properties of % changed',targets[k]; END IF;
 END LOOP;
END
$rollback$;
-- DROP FUNCTION private.inquiry_external_kind_apply_v1(uuid,jsonb,text,timestamptz);
-- DROP FUNCTION private.inquiry_external_kind_validate_v1(jsonb);
-- DROP FUNCTION private.inquiry_is_b2b_v1(uuid);
NOTIFY pgrst, 'reload schema';
