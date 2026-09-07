'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const root=path.resolve(__dirname,'..');
const base=path.join(root,'staging-phase1');
const candidate=path.join(root,'sql','operational-full-local-candidate','20260906');
const out=path.join(root,'staging-operational-full');
const hashBuffer=value=>crypto.createHash('sha256').update(value).digest('hex');
const hashFile=file=>hashBuffer(fs.readFileSync(file));

function copyTree(source,target){
 fs.mkdirSync(target,{recursive:true});
 for(const entry of fs.readdirSync(source,{withFileTypes:true})){
  const from=path.join(source,entry.name),to=path.join(target,entry.name);
  if(entry.isDirectory())copyTree(from,to);
  else if(entry.isFile())fs.copyFileSync(from,to);
  else throw Error('UNSUPPORTED_BASE_ENTRY:'+from);
 }
}

function sanitizeLegacyEndpoints(html,file){
 let next=html
  .replace(/<link rel="preconnect" href="https:\/\/nfrnd\.app\.n8n\.cloud" crossorigin>\r?\n?/g,'')
  .replace(/https:\/\/nfrnd\.app\.n8n\.cloud\/webhook\/crm-write/g,'urn:netform-crm:legacy-write-disabled');
 if(/nfrnd\.app\.n8n\.cloud|ymfbmpnizxvqsamnczow/.test(next))throw Error('FORBIDDEN_ENDPOINT_REMAINS:'+file);
 return next;
}

function hardenCrmReadMappings(html){
 const newLink="function linkedDeal(q){\n  var explicit=q&&(q.deal_id||q.opportunity_id),byId=explicit&&(B.deals||[]).filter(function(d){return String(d.id||d.opportunity_id)===String(explicit)})[0];\n  if(byId)return byId;\n  var k=normSite(q&&q.site);if(!k)return null;\n  var M=(B.deals||[]).filter(function(d){var dk=normSite(d.site);return !!dk&&dk===k});";
 const beforeLink=html;
 html=html.replace(/function linkedDeal\(q\)\{\r?\n  var k=normSite\(q\.site\),M=\(B\.deals\|\|\[\]\)\.filter\(function\(d\)\{return normSite\(d\.site\)===k\}\);/,newLink);
 if(html===beforeLink)throw Error('CRM_LINK_MAPPING_DRIFT');
 const oldOwner=/function inquirySalesOwner\(q\)\{var n=repN\(q\.assigned_to\|\|q\.sales_assignee\|\|q\.salesAssignee\|\|q\.assignee\),p=repProfile\(n\);return p\.active&&p\.salesRep&&p\.role!==\'branch_pool\'\?n:\'\'\}\r?\nfunction inquiryRoutedOwner\(q\)\{var n=inquirySalesOwner\(q\);if\(n\)return n;var raw=repN\(q\.assigned_to\|\|q\.assignee\),p=repProfile\(raw\);return p\.active&&p\.role===\'branch_pool\'\?raw:\'\'\}/;
 const newOwner="function inquirySalesOwner(q){var n=repN(q.assignee_name||q.sales_assignee||q.salesAssignee||q.assignee||q.assigned_to),p=repProfile(n);return p.active&&p.salesRep&&p.role!=='branch_pool'?n:''}\nfunction inquiryRoutedOwner(q){var n=inquirySalesOwner(q);if(n)return n;var raw=repN(q.assignee_name||q.assignee||q.assigned_to),p=repProfile(raw);return p.active&&p.role==='branch_pool'?raw:''}";
 const beforeOwner=html;html=html.replace(oldOwner,newOwner);
 if(html===beforeOwner)throw Error('CRM_OWNER_MAPPING_DRIFT');
 return html;
}

function injectPage(file){
 const target=path.join(out,file),before=fs.readFileSync(target,'utf8');
 let html=sanitizeLegacyEndpoints(before,file);
 if(file==='crm.html')html=hardenCrmReadMappings(html);
 const oldHead='<script src="/phase1-config.js"></script><script src="/transport.js"></script>';
 const newHead='<script src="/phase1-config.js"></script><script src="/operational-adapter.js"></script><script src="/transport.js"></script>';
 html=html.replace(oldHead,newHead);
 if(!html.includes(newHead)||html.includes(oldHead))throw Error('HEAD_LOAD_ORDER_DRIFT:'+file);
 if(file!=='index.html'){
  const boot=file==='crm.html'?'Promise.resolve(AUTH_READY).catch':'if(!DEVVIEW)document.body.classList.add(\'svc\');';
  const split='</script><script src="/operational-overlay.js"></script><script>'+boot;
  html=html.replace(boot,split);
  if(!html.includes(split))throw Error('OVERLAY_BOOT_MARKER_DRIFT:'+file);
 }
 fs.writeFileSync(target,html);
 return {
  source_sha256:hashBuffer(Buffer.from(before)),
  output_sha256:hashBuffer(Buffer.from(html)),
  config_index:html.indexOf('/phase1-config.js'),
  adapter_index:html.indexOf('/operational-adapter.js'),
  transport_index:html.indexOf('/transport.js'),
  overlay_index:file==='index.html'?null:html.lastIndexOf('/operational-overlay.js'),
  body_end:html.lastIndexOf('</body>')
 };
}

function build(){
 for(const required of [base,candidate])if(!fs.existsSync(required))throw Error('MISSING_SOURCE:'+required);
 copyTree(base,out);
 const assets={
  'operational-adapter.js':'operational-adapter.candidate.js',
  'operational-overlay.js':'operational-overlay.candidate.js',
  'transport.js':'transport.candidate.js'
 };
 for(const [output,source] of Object.entries(assets))fs.copyFileSync(path.join(candidate,source),path.join(out,output));
 const pages=Object.fromEntries(['index.html','crm.html','mobile.html'].map(file=>[file,injectPage(file)]));
 const manifestSource=JSON.parse(fs.readFileSync(path.join(candidate,'manifest.json'),'utf8'));
 if(manifestSource.project_ref!=='rprechiaglyjaydkmxsu'||manifestSource.operations?.length!==31)throw Error('CANDIDATE_SCOPE_DRIFT');
 const forbiddenText=['index.html','crm.html','mobile.html'].map(file=>fs.readFileSync(path.join(out,file),'utf8')).join('\n');
 const manifest={
  project_ref:'rprechiaglyjaydkmxsu',
  status:'LOCAL_31_OP_UI_ASSEMBLED_NOT_DEPLOYED',
  source:'staging-phase1 UI plus operational-full-local-candidate/20260906 assets',
  output:'staging-operational-full',
  connected_operations:manifestSource.operations,
  operation_count:manifestSource.operations.length,
  legacy_write_endpoint:'urn:netform-crm:legacy-write-disabled',
  forbidden_references:{n8n:(forbiddenText.match(/nfrnd\.app\.n8n\.cloud/g)||[]).length,production_ref:(forbiddenText.match(/ymfbmpnizxvqsamnczow/g)||[]).length},
  source_sha256:{candidate_manifest:hashFile(path.join(candidate,'manifest.json')),adapter:hashFile(path.join(candidate,assets['operational-adapter.js'])),overlay:hashFile(path.join(candidate,assets['operational-overlay.js'])),transport:hashFile(path.join(candidate,assets['transport.js']))},
  output_sha256:{adapter:hashFile(path.join(out,'operational-adapter.js')),overlay:hashFile(path.join(out,'operational-overlay.js')),transport:hashFile(path.join(out,'transport.js'))},
  pages,
  local_browser_revalidation_required:true,
  staging_deployment_performed:false,
  staging_ddl_dml_performed:false,
  production_accessed:false,
  n8n_accessed:false
 };
 fs.writeFileSync(path.join(out,'operational-full-ui-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}

if(require.main===module)console.log(JSON.stringify(build(),null,2));
module.exports={root,base,candidate,out,build,sanitizeLegacyEndpoints,hardenCrmReadMappings};
