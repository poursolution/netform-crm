'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
process.env.TZ='Asia/Seoul';
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function fixture(inquiries=[]){
 const w={Intl,Date,console,G:{},B:{inquiries},document:{readyState:'loading',addEventListener(){}},esc:String,escAttr:String,
  itemPatch:()=>({}),actionObj:d=>d.next||null,repN:v=>v||'',inquiryRoutedOwner:q=>q.assignee,
  operationalInquiries:qs=>qs,isClosedInq:q=>!!q.closed,inqCtlConverted:q=>!!q.deal_id,
  inquiryAssignedAt:q=>q.assigned_at,inqCtlFirstResponseAt:q=>q.responded_at||'',
  InquiryListV3:{contactReview:q=>({required:!!q.review}),contactAt:q=>q.responded_at||''},
  PipelineStages:{group:()=> 'consulting'},dealStage:()=> 'consulting',dealKey:d=>d.id,inqKey:q=>q.id,
  PipelineJudge:{dayKey:v=>String(v||'').slice(0,10),week:()=>({mon:'2026-10-05',fri:'2026-10-09'}),basis:d=>d,missKind:d=>d.missing||''}};
 w.window=w;vm.createContext(w);vm.runInContext(read('exec-wording.js'),w);return w;
}
test('next-action omissions appear in the repair count and its evidence without changing assignment judgment',()=>{
 const w=fixture(),deals=Array.from({length:17},(_,i)=>({id:'d'+i,site:'Synthetic '+i})),before=JSON.stringify(deals);
 const l=w.ExecWording.loadOf({nm:'TEST REP',current:deals,stale:17},[]),s=w.ExecWording.specLoad(l);
 assert.equal(l.judge,'기록 보완 먼저');assert.equal(l.counts.fix,17);assert.equal(s.tiles[2][1],'17건');
 assert.equal(s.rows.length,17);assert.equal(new Set(s.rows.map(r=>r.k)).size,17);
 assert.ok(s.rows.every(r=>r.j==='다음 할 일 없음'));
 assert.equal(JSON.stringify(deals),before);
});
test('one deal with multiple missing requirements counts once while inquiry IDs remain a separate namespace',()=>{
 const q={id:'same',site:'Synthetic inquiry',assignee:'TEST REP',review:true},w=fixture([q]);
 const d={id:'same',site:'Synthetic deal',missing:'past'},l=w.ExecWording.loadOf({nm:'TEST REP',current:[d]},[]),s=w.ExecWording.specLoad(l);
 assert.equal(l.counts.fix,2);assert.equal(s.tiles[2][1],'2건');assert.equal(s.rows.length,2);
 assert.equal(s.rows.filter(r=>r.kind==='inq').length,1);
 const row=s.rows.find(r=>r.kind==='deal');assert.match(row.e,/과거 이관/);assert.match(row.e,/다음 할 일/);
});
test('complete next action is not counted as a repair and first-contact priority stays first',()=>{
 const w=fixture([{id:'q',assignee:'TEST REP'}]),d={id:'ok',next:{text:'방문',due:'2099-01-01'}},l=w.ExecWording.loadOf({nm:'TEST REP',current:[d]},[]);
 assert.equal(l.counts.fix,0);assert.equal(l.judge,'첫 연락 먼저');assert.equal(w.ExecWording.specLoad(l).rows.length,1);
});
test('salesperson workload binds the shared repair count without changing its markup',()=>{
 const source=read('reps-b.js'),start=source.indexOf(' function loadHtml('),end=source.indexOf('\n function paint(',start);
 const w=fixture(),l=w.ExecWording.loadOf({nm:'TEST REP',current:[{id:'missing'}]},[]);
 w.root=w;w.h=String;w.attr=String;vm.runInContext(source.slice(start,end)+'\nthis.renderLoad=loadHtml;',w);
 assert.match(w.renderLoad([],[l]),/<span class="g">1<\/span><button type="button" class="tag"/);
});
