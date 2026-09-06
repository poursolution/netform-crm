'use strict';
// Generate credentials only outside the repository; never log their values.
const fs=require('node:fs'),crypto=require('node:crypto');
const {REF,accounts}=require('./build-observed-synthetic-seed.cjs');
const target='C:/Users/Administrator/crm-staging-private/auth-synthetic-20260905.json';
if(fs.existsSync(target))throw Error('Private credential file already exists; refusing overwrite');
fs.writeFileSync(target,JSON.stringify({project_ref:REF,accounts:accounts.map(a=>({...a,password:crypto.randomBytes(30).toString('base64url')+'!Aa7'}))},null,2),{flag:'wx',mode:0o600});
console.log('Six random passwords generated in private file. No credentials printed.');
