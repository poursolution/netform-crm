const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('UI labels normalize, both fields survive command queue; legacy sends remain legacy',async()=>{
 const sent=[],patch={};const w={G:{},ME:{id:'me',name:'담당'},console,localStorage:{getItem:()=>null,setItem(){}},
  OpsStore:{has:()=>true,rpc:async(n,p)=>{sent.push(JSON.parse(JSON.stringify(p)));return {ok:true};}},
  inquiryAssigned:()=>false,itemPatch:()=>patch,detailPatchFor:()=>patch,inqKey:q=>q.id,repN:v=>v,saveLocal(){},touchCustomer(){},
  crypto:require('node:crypto')};
 w.window=w;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../inquiry-flow.js'),'utf8'),w);
 const q={id:'10000000-0000-4000-8000-000000000001'},F=w.InquiryFlow;
 for(const [con,rea,expected] of [['회신 받음','자료 요청','자료요청'],['연결됨','관심 있음','연결됨'],['부재','거절','부재']]){
  const two=F.TWO.of(con,rea);
  w.InquiryCommand.run('contact_log',q,{ch:'전화',result:two.res,contact_result:two.contact_result,customer_reaction:two.customer_reaction,text:'synthetic'});
  await new Promise(r=>setImmediate(r));const p=sent.at(-1);assert.equal(p.result,expected);assert.equal(p.contact_result,con==='회신 받음'?'고객 회신':con);
  assert.equal(p.customer_reaction,con==='회신 받음'?'자료요청':'');
 }
 w.InquiryCommand.run('contact_log',q,{ch:'문자',result:'회신대기',text:'synthetic'});await new Promise(r=>setImmediate(r));
 assert.equal(Object.hasOwn(sent.at(-1),'contact_result'),false);assert.equal(Object.hasOwn(sent.at(-1),'customer_reaction'),false);
});
