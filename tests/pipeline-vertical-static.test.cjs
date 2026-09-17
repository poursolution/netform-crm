const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(root,'pipeline-vertical.js'),'utf8');
const css=fs.readFileSync(path.join(root,'pipeline-vertical.css'),'utf8');
const html=fs.readFileSync(path.join(root,'crm.html'),'utf8');
const toolbar=fs.readFileSync(path.join(root,'pipeline-toolbar.js'),'utf8');

test('pipeline renders every stage master entry in canonical sequence',()=>{
 assert.match(js,/stageSections=\(\)=>w\.STAGE_SEQ\.map/);
 assert.match(js,/title:w\.STAGE_MASTER\[code\]\.name/);
 assert.match(js,/w\.paintKanban=render/);
 assert.match(js,/closed:true/);
 assert.match(js,/w\.dealStage\(d\)===stage\.code/);
 assert.doesNotMatch(js,/const GROUPS=/);
 assert.match(html,/pipeline-vertical\.css/);
 assert.match(html,/pipeline-vertical\.js/);
});

test('pipeline rows preserve the three required actions and operational ordering',()=>{
 ['기록','다음 행동','단계 이동'].forEach(label=>assert.ok(js.includes(label),label));
 assert.match(js,/pipelineQuick/);
 assert.match(js,/openKb5/);
 assert.match(js,/rank:0/);
 assert.match(js,/rank:1/);
 assert.match(js,/rank:2/);
 assert.match(js,/rank:3/);
 assert.match(js,/rank:4/);
});

test('pipeline is responsive and owner selection is admin-only',()=>{
 assert.match(css,/\.pv-board/);
 assert.match(css,/@media\(max-width:1280px\)/);
 assert.match(css,/overflow-x:hidden/);
 assert.match(toolbar,/canChooseOwner/);
 assert.ok(toolbar.includes("['kb','단계 보드']"));
 assert.match(toolbar,/pipe-owner-self/);
});
