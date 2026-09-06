'use strict';
// Generates only the explicitly approved synthetic DUAL account. Credentials never leave private local storage except Auth login/signup.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir='C:/Users/Administrator/crm-staging-private',file=path.join(dir,'phase11-dual.json');
const c=JSON.parse(fs.readFileSync(path.join(dir,'v2-client.json'),'utf8'));
if(c.project_ref!=='rprechiaglyjaydkmxsu'||c.url!=='https://rprechiaglyjaydkmxsu.supabase.co')throw Error('WRONG_PROJECT');
async function main(){if(fs.existsSync(file)){console.log('DUAL credential record already exists; no duplicate signup.');return;}
 const a={kind:'DUAL',name:'TEST DUAL',email:'crm-dual@example.invalid',source_role:'dual',user_id:'f6090600-0001-4000-8000-000000000007',password:crypto.randomBytes(33).toString('base64url')};
 fs.writeFileSync(file,JSON.stringify({project_ref:c.project_ref,account:a,status:'PREPARED'},null,2),{flag:'wx'});
 // Use the supported Auth signup endpoint. If disabled/rejected, do not change Auth settings or invent Auth table rows.
 const r=await fetch(c.url+'/auth/v1/signup',{method:'POST',headers:{apikey:c.publishable_key,'Content-Type':'application/json'},body:JSON.stringify({email:a.email,password:a.password}),signal:AbortSignal.timeout(15000)}),data=await r.json();
 if(!r.ok){console.log(JSON.stringify({status:'SIGNUP_REJECTED',http:r.status,code:data.error_code||data.code}));return;}
 const u=data.user||data;if(!u.id||u.email!==a.email)throw Error('UNEXPECTED_AUTH_RESPONSE');a.auth_uid=u.id;
 fs.writeFileSync(file,JSON.stringify({project_ref:c.project_ref,account:a,status:u.email_confirmed_at?'CONFIRMED':'UNCONFIRMED'},null,2));
 const out=path.resolve(__dirname,'../sql/phase11');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'dual-auth-mapping.json'),JSON.stringify({project_ref:c.project_ref,kind:a.kind,name:a.name,email:a.email,user_id:a.user_id,auth_uid:a.auth_uid,confirmed:!!u.email_confirmed_at},null,2));
 console.log(JSON.stringify({status:'AUTH_CREATED',confirmed:!!u.email_confirmed_at}));
}
main().catch(()=>{console.error('DUAL_AUTH_FAILED (secret-safe)');process.exitCode=1;});
