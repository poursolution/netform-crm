const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const migration=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261005030110_inquiry_external_response_projection.sql'),'utf8');
test('response projection preserves authorization, allowlists history and is idempotent',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`CREATE SCHEMA crm_security;
   CREATE TABLE public.inquiries(id uuid,address text,close_reason text,raw jsonb,allowed boolean);
   CREATE FUNCTION crm_security.actor() RETURNS TABLE(user_id uuid) LANGUAGE sql AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid WHERE current_setting('test.actor',true)='yes'$$;
   CREATE FUNCTION crm_security.can_inquiry(p_id uuid) RETURNS boolean LANGUAGE sql AS $$SELECT allowed FROM public.inquiries WHERE id=p_id$$;
   CREATE FUNCTION crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906(p_domain text,p_after uuid,p_limit integer)
   RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
   DECLARE a record; result jsonb;
   BEGIN
    SELECT * INTO a FROM crm_security.actor();
    IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
    SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) INTO result FROM (SELECT i.id,
    i.address,
    jsonb_build_object('response',i.raw->>'응대내용') AS detail
    FROM public.inquiries i WHERE crm_security.can_inquiry(i.id) ORDER BY i.id LIMIT p_limit) q;
    RETURN result;
   END $function$;
   REVOKE ALL ON FUNCTION crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906(text,uuid,integer) FROM PUBLIC;
   SET test.actor='yes';`);
  const raw={응대내용:'옛 원문',secret:'must not leak',external_change_history:[{kind:'assignment',after:{secret:'no'}},{kind:'response',event_id:'e1',source_at:'2026-10-05T02:15:18Z',before:{secret:'no'},after:{response_content:'답변',status:'배드핏',close_reason:'사유',secret:'no'}},{kind:'response',after:'malformed'}]};
  for(let n=1;n<=2;n++)await db.query('INSERT INTO public.inquiries VALUES($1,$2,$3,$4,$5)',[`00000000-0000-0000-0000-00000000000${n}`,'주소','종료',JSON.stringify(raw),n===1]);
  const metadata=()=>db.query("SELECT proacl,proconfig,prosecdef FROM pg_proc WHERE oid='crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906(text,uuid,integer)'::regprocedure");
  const before=await metadata();
  await db.exec(migration);await db.exec(migration);
  assert.deepEqual(await metadata(),before);
  const result=await db.query("SELECT crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906('inquiry_core',null,100) AS result");
  const items=result.rows[0].result;assert.equal(items.length,1);assert.equal(items[0].detail.response,'옛 원문');assert.equal(items[0].raw.응대내용,'옛 원문');assert.equal(items[0].close_reason,'종료');
  assert.deepEqual(items[0].raw.external_change_history,[{kind:'response',event_id:'e1',source_at:'2026-10-05T02:15:18Z',after:{response_content:'답변',status:'배드핏',close_reason:'사유'}}]);
  assert.ok(!JSON.stringify(items).includes('secret'));assert.ok(!JSON.stringify(items).includes('must not leak'));
  await db.exec("UPDATE public.inquiries SET raw='{}'::jsonb");
  const empty=await db.query("SELECT crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906('inquiry_core',null,100) AS result");
  assert.deepEqual(empty.rows[0].result[0].raw.external_change_history,[]);
  await db.exec("SET test.actor='no'");
  await assert.rejects(db.query("SELECT crm_security.crm_operational_source_fragment_pre_inquiry_response_20260906('inquiry_core',null,100)"),/forbidden/);
 }finally{await db.close();}
});

