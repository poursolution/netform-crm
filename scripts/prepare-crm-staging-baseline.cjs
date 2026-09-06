'use strict';
// Prepares an apply artifact, NEVER connects to any database.
const fs=require('node:fs');const path=require('node:path');
const {dir,sha,normalize}=require('./crm-baseline-metadata.cjs');
const original=fs.readFileSync(path.join(dir,'public-baseline.sql'),'utf8');
const expectedHash='1899adacb05b6fe07d187f76fe2fc57a1842be40fb73a47fad9a951eb5e4de78';
if(sha(original)!==expectedHash)throw Error('Reviewed baseline SHA256 changed');
const before=JSON.parse(fs.readFileSync(path.join(dir,'staging-before.json'),'utf8'));
const source=JSON.parse(fs.readFileSync(path.join(dir,'source-metadata.json'),'utf8')).payload;
if(before.project_ref!=='rprechiaglyjaydkmxsu'||before.snapshot.relations!==null||before.snapshot.function_count!==0||before.snapshot.type_count!==0)throw Error('Not verified empty staging');
for(const key of ['schema','default_privileges','extensions'])if(JSON.stringify(normalize(before.snapshot[key]))!==JSON.stringify(normalize(source[key])))throw Error('Before drift: '+key);
const acl=JSON.stringify(before.snapshot.schema.acl).replaceAll("'","''");
const defaults=JSON.stringify(before.snapshot.default_privileges).replaceAll("'","''");
const gate=`
-- Attestations activate the EXISTING reviewed approval guard for this one approved target.
-- The operator must independently confirm dashboard/connection ref before submitting.
SET LOCAL crm.baseline_staging_ref='rprechiaglyjaydkmxsu';
SET LOCAL crm.baseline_only_approved='yes';
SET LOCAL crm.synthetic_isolation_confirmed='yes';
DO $before_check$ DECLARE actual jsonb; expected jsonb; BEGIN
 SELECT to_jsonb(nspacl) INTO actual FROM pg_namespace WHERE nspname='public';
 expected:='${acl}'::jsonb;
 IF NOT (actual @> expected AND expected @> actual) THEN RAISE EXCEPTION 'Before public ACL drift'; END IF;
 SELECT jsonb_agg(jsonb_build_object('creator',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'type',d.defaclobjtype,'acl',d.defaclacl)) INTO actual
 FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclnamespace=0 OR n.nspname='public';
 expected:='${defaults}'::jsonb;
 IF NOT (actual @> expected AND expected @> actual) THEN RAISE EXCEPTION 'Before defaults drift'; END IF;
END $before_check$;
`;
const apply=`-- DO NOT SUBMIT UNTIL ACTION-TIME BROWSER CONFIRMATION IS RECEIVED.
-- Target: netform-crm-staging / rprechiaglyjaydkmxsu ONLY.
-- Original file verified SHA256: ${expectedHash}
-- Original baseline preserved; only per-transaction approval/precondition statements inserted.
`+original.replace('BEGIN;\n','BEGIN;\n'+gate);
if((apply.match(/^BEGIN;$/gm)||[]).length!==1||(apply.match(/^COMMIT;$/gm)||[]).length!==1)throw Error('One transaction required');
fs.writeFileSync(path.join(dir,'staging-apply.sql'),apply);
console.log(JSON.stringify({preparedOnly:true,original_sha256:expectedHash,apply_sha256:sha(apply),bytes:Buffer.byteLength(apply)}));
