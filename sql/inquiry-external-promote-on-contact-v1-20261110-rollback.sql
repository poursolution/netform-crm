-- 되돌리기: sql/inquiry-external-promote-on-contact-v1-20261110.sql
-- apply 함수에서 'inquiry_external_promote_on_contact_v1' 두 곳을 원래 문장으로 되돌리고 promote_v2 를 지운다.
DO $rb$
DECLARE
 apply_fn regprocedure:='private.inquiry_external_flow_apply_v1(uuid,jsonb,text,timestamptz)'::regprocedure; d text; n integer;
 e_old text:=$a$IF v_label IS NULL AND v_day IS NULL THEN RETURN jsonb_build_object('ok',true,'reason','RESPONSE_SYNCED'); END IF;$a$;
 e_new text:=$a$IF v_label IS NULL AND v_day IS NULL AND NOT coalesce((SELECT coalesce(x.status,'') ~ '전화\s*응대\s*완료|현장\s*방문\s*(완료|예정)|견적.*발송' FROM public.inquiries x WHERE x.id=p_inquiry_id),false) THEN RETURN jsonb_build_object('ok',true,'reason','RESPONSE_SYNCED'); END IF; -- inquiry_external_promote_on_contact_v1$a$;
 t_old text:=$a$ RETURN jsonb_build_object('ok',true,'reason',v_reason,'flow',flow);
END $a$;
 t_new text:=$a$ -- 응대 상태로 영업건(CRM 화면 정착 모드와 같은 기준) -- inquiry_external_promote_on_contact_v1
 IF v_day IS NULL AND coalesce((SELECT coalesce(x.status,'') ~ '전화\s*응대\s*완료|현장\s*방문\s*(완료|예정)|견적.*발송' FROM public.inquiries x WHERE x.id=q.id),false) THEN
  BEGIN
   conv:=private.inquiry_external_promote_v2(q.id,p_event_id,(SELECT coalesce(x.status,'응대')||' 상태로 파이프라인 인계(잔디 응대 페이지)' FROM public.inquiries x WHERE x.id=q.id));
  EXCEPTION WHEN others THEN
   conv:=jsonb_build_object('ok',false,'reason','PROMOTE_FAILED:'||SQLSTATE);
  END;
  flow:=flow||jsonb_build_object('promotion',conv);
  IF coalesce((conv->>'ok')::boolean,false) IS NOT TRUE THEN v_reason:='RESPONSE_SYNCED_CONVERSION_REVIEW'; END IF;
 END IF;
 RETURN jsonb_build_object('ok',true,'reason',v_reason,'flow',flow);
END $a$;
BEGIN
 d:=pg_get_functiondef(apply_fn);
 IF position('inquiry_external_promote_on_contact_v1' in d)>0 THEN
  n:=(length(d)-length(replace(d,e_new,'')))/length(e_new); IF n<>1 THEN RAISE EXCEPTION 'early % times',n; END IF;
  n:=(length(d)-length(replace(d,t_new,'')))/length(t_new); IF n<>1 THEN RAISE EXCEPTION 'tail % times',n; END IF;
  EXECUTE replace(replace(d,e_new,e_old),t_new,t_old);
 END IF;
 DROP FUNCTION IF EXISTS private.inquiry_external_promote_v2(uuid,text,text);
END
$rb$;
