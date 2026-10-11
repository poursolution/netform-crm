-- PC/mobile common contact contract. Prepared locally; not applied to Production.
-- Patch only the observed go handler (catalog captured 2026-10-11).
-- Existing identity, company, assignment, primary-contact and version rules remain unchanged.
begin;

do $migration$
declare
  installed text;
  reconstructed text;
  old_vars text := ' v_week_start date; comment_status text; changed boolean:=true;';
  new_vars text := E' v_week_start date; comment_status text; changed boolean:=true;\n effective_contact_consent jsonb; contact_consent_key text; -- contact-consent-preserve-omitted-v1';
  old_save text := $old_save$    INSERT INTO crm_security.contact_compat_state(contact_id,deal_id,sms_consent,kakao_consent,consent_at,opt_out_at,send_blocked,send_blocked_reason,updated_by_auth_uid,updated_by_user_id,updated_at)
     VALUES(v_contact_id,p_object_id,coalesce((p_payload->>'sms_consent')::boolean,false),coalesce((p_payload->>'kakao_consent')::boolean,false),nullif(p_payload->>'consent_at','')::timestamptz,nullif(p_payload->>'opt_out_at','')::timestamptz,coalesce((p_payload->>'send_blocked')::boolean,false),nullif(btrim(coalesce(p_payload->>'send_blocked_reason','')),''),a.auth_uid,a.user_id,server_at)
     ON CONFLICT(contact_id,deal_id) DO UPDATE SET sms_consent=excluded.sms_consent,kakao_consent=excluded.kakao_consent,consent_at=excluded.consent_at,opt_out_at=excluded.opt_out_at,send_blocked=excluded.send_blocked,send_blocked_reason=excluded.send_blocked_reason,updated_by_auth_uid=excluded.updated_by_auth_uid,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at;$old_save$;
  new_save text := $new_save$    -- Merge only keys explicitly supplied by the caller, inside the existing transaction.
    SELECT jsonb_build_object('sms_consent',s.sms_consent,'kakao_consent',s.kakao_consent,'consent_at',s.consent_at,'opt_out_at',s.opt_out_at,'send_blocked',s.send_blocked,'send_blocked_reason',s.send_blocked_reason)
      INTO effective_contact_consent FROM crm_security.contact_compat_state s
      WHERE s.contact_id=v_contact_id AND s.deal_id=p_object_id FOR UPDATE;
    effective_contact_consent:=coalesce(effective_contact_consent,'{"sms_consent":false,"kakao_consent":false,"consent_at":null,"opt_out_at":null,"send_blocked":false,"send_blocked_reason":null}'::jsonb);
    FOREACH contact_consent_key IN ARRAY ARRAY['sms_consent','kakao_consent','send_blocked'] LOOP
      IF p_payload ? contact_consent_key THEN
        IF jsonb_typeof(p_payload->contact_consent_key) IS DISTINCT FROM 'boolean' THEN
          RAISE EXCEPTION 'invalid contact consent boolean' USING ERRCODE='22023';
        END IF;
        effective_contact_consent:=jsonb_set(effective_contact_consent,ARRAY[contact_consent_key],p_payload->contact_consent_key);
      END IF;
    END LOOP;
    FOREACH contact_consent_key IN ARRAY ARRAY['consent_at','opt_out_at'] LOOP
      IF p_payload ? contact_consent_key THEN
        IF jsonb_typeof(p_payload->contact_consent_key) NOT IN('string','null') THEN
          RAISE EXCEPTION 'invalid contact consent timestamp' USING ERRCODE='22023';
        END IF;
        IF nullif(btrim(p_payload->>contact_consent_key),'') IS NOT NULL
           AND NOT isfinite((p_payload->>contact_consent_key)::timestamptz) THEN
          RAISE EXCEPTION 'invalid contact consent timestamp' USING ERRCODE='22023';
        END IF;
        effective_contact_consent:=jsonb_set(effective_contact_consent,ARRAY[contact_consent_key],coalesce(to_jsonb(nullif(btrim(p_payload->>contact_consent_key),'')::timestamptz),'null'::jsonb));
      END IF;
    END LOOP;
    IF p_payload ? 'send_blocked_reason' THEN
      IF jsonb_typeof(p_payload->'send_blocked_reason') NOT IN('string','null') THEN
        RAISE EXCEPTION 'invalid contact block reason' USING ERRCODE='22023';
      END IF;
      effective_contact_consent:=jsonb_set(effective_contact_consent,'{send_blocked_reason}',coalesce(to_jsonb(nullif(btrim(p_payload->>'send_blocked_reason'),'')),'null'::jsonb));
    END IF;
    IF (((effective_contact_consent->>'sms_consent')::boolean OR (effective_contact_consent->>'kakao_consent')::boolean)
          AND (effective_contact_consent->>'consent_at' IS NULL OR (effective_contact_consent->>'send_blocked')::boolean OR effective_contact_consent->>'opt_out_at' IS NOT NULL))
       OR ((effective_contact_consent->>'send_blocked')::boolean
          AND ((effective_contact_consent->>'sms_consent')::boolean OR (effective_contact_consent->>'kakao_consent')::boolean OR effective_contact_consent->>'opt_out_at' IS NULL)) THEN
      RAISE EXCEPTION 'invalid merged contact consent' USING ERRCODE='22023';
    END IF;
    INSERT INTO crm_security.contact_compat_state(contact_id,deal_id,sms_consent,kakao_consent,consent_at,opt_out_at,send_blocked,send_blocked_reason,updated_by_auth_uid,updated_by_user_id,updated_at)
     VALUES(v_contact_id,p_object_id,(effective_contact_consent->>'sms_consent')::boolean,(effective_contact_consent->>'kakao_consent')::boolean,(effective_contact_consent->>'consent_at')::timestamptz,(effective_contact_consent->>'opt_out_at')::timestamptz,(effective_contact_consent->>'send_blocked')::boolean,effective_contact_consent->>'send_blocked_reason',a.auth_uid,a.user_id,server_at)
     ON CONFLICT(contact_id,deal_id) DO UPDATE SET sms_consent=excluded.sms_consent,kakao_consent=excluded.kakao_consent,consent_at=excluded.consent_at,opt_out_at=excluded.opt_out_at,send_blocked=excluded.send_blocked,send_blocked_reason=excluded.send_blocked_reason,updated_by_auth_uid=excluded.updated_by_auth_uid,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at;
    -- Read the persisted values (including any existing server triggers) into the receipt.
    SELECT jsonb_build_object('sms_consent',s.sms_consent,'kakao_consent',s.kakao_consent,'consent_at',s.consent_at,'opt_out_at',s.opt_out_at,'send_blocked',s.send_blocked,'send_blocked_reason',s.send_blocked_reason)
      INTO effective_contact_consent FROM crm_security.contact_compat_state s WHERE s.contact_id=v_contact_id AND s.deal_id=p_object_id;$new_save$;
  old_ack text := E'\n ELSIF p_operation=''rep_manager_comment'' THEN';
  new_ack text := E'\n  IF p_operation=''contact_upsert'' THEN\n   ack:=ack||jsonb_build_object(''contact_consent_contract'',''preserve-omitted-v1'',''consent'',effective_contact_consent);\n  END IF;\n\n ELSIF p_operation=''rep_manager_comment'' THEN';
begin
  if to_regprocedure('crm_security.crm_operational_go_command_v1(uuid,text,uuid,integer,jsonb)') is null then
    raise exception 'CONTACT_GO_BASE_MISSING';
  end if;
  installed:=pg_get_functiondef('crm_security.crm_operational_go_command_v1(uuid,text,uuid,integer,jsonb)'::regprocedure);
  reconstructed:=replace(replace(replace(installed,new_vars,old_vars),new_save,old_save),new_ack,old_ack);
  if md5(reconstructed)<>'a0209794d0844913f287bd9da509e3e1' then
    raise exception 'CONTACT_GO_BASE_HASH_MISMATCH';
  end if;
  if position(old_vars in reconstructed)=0 or position(old_save in reconstructed)=0 or position(old_ack in reconstructed)=0 then
    raise exception 'CONTACT_GO_PATCH_ANCHOR_MISSING';
  end if;
  execute replace(replace(replace(reconstructed,old_vars,new_vars),old_save,new_save),old_ack,new_ack);
end
$migration$;

-- A distinct common entry point fails before mutation on servers that lack this contract.
-- Never fall back from this function to a legacy RPC in the client.
create or replace function public.crm_contact_command_v1(
  p_request_id uuid, p_operation text, p_object_id uuid, p_expected_version integer, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  a record;
  result jsonb;
  stored crm_security.command_receipts%rowtype;
  field_name text;
begin
  select * into a from crm_security.actor();
  if a.user_id is null or a.auth_uid is distinct from auth.uid() or not crm_security.can_deal(p_object_id,true) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_operation is distinct from 'contact_upsert' or p_request_id is null or p_object_id is null
     or p_expected_version is null or p_expected_version<0 or jsonb_typeof(p_payload) is distinct from 'object'
     or p_payload->>'opportunity_id' is distinct from p_object_id::text then
    raise exception 'invalid contact command' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in
    ('opportunity_id','site_id','person_key','site_name','office_phone','office_email','manager_name','manager_mobile','manager_role','is_primary','started_at','sms_consent','kakao_consent','consent_at','opt_out_at','send_blocked','send_blocked_reason')) then
    raise exception 'invalid contact payload' using errcode='22023';
  end if;
  result:=public.crm_write_command_v2(p_request_id,p_operation,p_object_id,p_expected_version,p_payload);
  select * into stored from crm_security.command_receipts where actor_auth_uid=a.auth_uid and request_id=p_request_id;
  if not found or stored.actor_user_id is distinct from a.user_id or stored.operation is distinct from p_operation
     or stored.object_id is distinct from p_object_id or stored.expected_version is distinct from p_expected_version
     or stored.payload is distinct from p_payload or jsonb_typeof(result) is distinct from 'object'
     or result->'contract_version' is distinct from '1'::jsonb or result->'ok' is distinct from 'true'::jsonb
     or jsonb_typeof(result->'replayed') is distinct from 'boolean'
     or result->>'contact_consent_contract' is distinct from 'preserve-omitted-v1'
     or stored.ack->>'contact_consent_contract' is distinct from 'preserve-omitted-v1'
     or (result-'replayed') is distinct from (stored.ack-'replayed')
     or jsonb_typeof(result->'consent') is distinct from 'object'
     or result->>'actor_auth_uid' is distinct from a.auth_uid::text or result->>'actor_user_id' is distinct from a.user_id::text
     or result->>'request_id' is distinct from p_request_id::text or result->>'object_id' is distinct from p_object_id::text
     or result->>'operation' is distinct from p_operation or result->>'person_key' is distinct from p_payload->>'person_key'
     or coalesce(result->>'contact_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or coalesce(result->>'audit_event_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or jsonb_typeof(result->'server_at') is distinct from 'string'
     or result->>'previous_version' is distinct from p_expected_version::text
     or result->>'version' is distinct from (p_expected_version+1)::text then
    raise exception 'CONTACT_CONSENT_CONTRACT_MISMATCH' using errcode='PT409';
  end if;
  if (select count(*) from jsonb_object_keys(result->'consent'))<>6 then
    raise exception 'CONTACT_CONSENT_CONTRACT_MISMATCH' using errcode='PT409';
  end if;
  foreach field_name in array array['sms_consent','kakao_consent','send_blocked'] loop
    if jsonb_typeof(result->'consent'->field_name) is distinct from 'boolean' then
      raise exception 'CONTACT_CONSENT_CONTRACT_MISMATCH' using errcode='PT409';
    end if;
  end loop;
  foreach field_name in array array['consent_at','opt_out_at','send_blocked_reason'] loop
    if not (result->'consent' ? field_name) or jsonb_typeof(result->'consent'->field_name) not in('string','null') then
      raise exception 'CONTACT_CONSENT_CONTRACT_MISMATCH' using errcode='PT409';
    end if;
  end loop;
  return result;
end
$function$;
revoke all on function public.crm_contact_command_v1(uuid,text,uuid,integer,jsonb) from public,anon,service_role;
grant execute on function public.crm_contact_command_v1(uuid,text,uuid,integer,jsonb) to authenticated;
comment on function public.crm_contact_command_v1(uuid,text,uuid,integer,jsonb) is
  'PC/mobile shared contact_upsert; preserve-omitted-v1; no legacy fallback; receipt contains persisted consent.';
commit;
