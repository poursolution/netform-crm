'use strict';
const {spawnSync}=require('node:child_process');
const path=require('node:path');
// Configuration absence MUST fail this approval command, never yield 11 SKIP.
const result=spawnSync(process.execPath,['--test',path.join(__dirname,'../tests/crm-security.integration.test.cjs')],{
 env:{...process.env,CRM_REQUIRE_STAGING:'1'},stdio:'inherit'
});
process.exit(result.status??1);
