const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(root,'pipeline-vertical.js'),'utf8');
const css=fs.readFileSync(path.join(root,'pipeline-vertical.css'),'utf8');
const html=fs.readFileSync(path.join(root,'crm.html'),'utf8');
const toolbar=fs.readFileSync(path.join(root,'pipeline-toolbar.js'),'utf8');

test('pipeline defaults to five vertical operating sections',()=>{
 ['1차 접촉·컨설팅','유대·침묵·대기','경쟁·임박·입찰','계약·시공','종료'].forEach(label=>assert.ok(js.includes(label),label));
 assert.match(js,/w\.paintKanban=render/);
 assert.match(js,/closed:true/);
 assert.match(js,/group\.closed&&/);
 assert.match(html,/pipeline-vertical\.css/);
 assert.match(html,/pipeline-vertical\.js/);
});

test('pipeline rows preserve the three required actions and operational ordering',()=>{
 ['응대 기록','다음 행동','상세'].forEach(label=>assert.ok(js.includes(label),label));
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
