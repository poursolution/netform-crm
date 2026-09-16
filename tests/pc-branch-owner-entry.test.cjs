const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../crm.html'),'utf8');
function load(names,ctx){vm.createContext(ctx);for(const name of names){const line=source.split('\n').find(x=>x.startsWith('function '+name+'('));assert.ok(line,name);vm.runInContext(line,ctx);}return ctx;}
test('branch detail opens existing real-owner dialog without changing consultant',()=>{
 const q={id:'test',assignee:'경남지사',consultant_name:'상담 직원'};let opened;
 const c=load(['gnOpenOwnerByKey'],{inqCtlIsAdmin:()=>true,inqCtlFind:()=>q,itemOwnerTeam:()=> 'gyeongnam',inqKey:x=>x.id,GN_INQ_CACHE:[],gnOpenOwner:i=>opened=i});
 c.gnOpenOwnerByKey('test');assert.equal(opened,0);assert.equal(c.GN_INQ_CACHE[0],q);assert.equal(q.consultant_name,'상담 직원');
 c.gnOpenOwnerByKey('test');assert.equal(c.GN_INQ_CACHE.length,1);
});
test('both branch reps select visibly, enable confirm and use existing assignment intent',()=>{
 for(const rep of ['조민준','김훈']){
  const q={assignee:'경남지사',consultant_name:'상담 직원'},button={disabled:true},cards=['조민준','김훈'].map(n=>({dataset:{r:n},classList:{toggle:(k,on)=>{if(n===rep)assert.equal(on,true);}}}));let saved,painted=false;
  const c=load(['inqCtlChooseRep','inqCtlUpdateAssignConfirm','gnConfirmOwner','gnAssignedRep'],{INQ_CTL_MODAL:{mode:'branch_owner',keys:['test'],rep:'',reassign:false},repProfile:()=>({team:'gyeongnam',reportingGroup:'external'}),document:{querySelectorAll:()=>cards},$:s=>s==='#inq-ctl-confirm'?button:{value:''},inqCtlFind:()=>q,inqCtlRecordAssignment:(row,n,reason,intent)=>{saved=intent;row.assignee=n;row.assignment_group='gyeongnam';},saveLocal:()=>{},G:{},closeInquiryControlModal:()=>{},paint:()=>painted=true,repN:n=>n,repTeam:()=> 'gyeongnam',gnIsPool:n=>n==='경남지사'});
  c.inqCtlChooseRep(rep);assert.equal(button.disabled,false);c.gnConfirmOwner();assert.equal(saved,'branch_owner_assign');assert.equal(c.gnAssignedRep(q),rep);assert.equal(q.consultant_name,'상담 직원');assert.equal(painted,true);
 }
});
test('owner entry still blocks non-admins, missing inquiries and non-branch inquiries',()=>{
 for(const scenario of [{admin:false,team:'gyeongnam',q:{id:'q'}},{admin:true,team:'hq',q:{id:'q'}},{admin:true,team:'gyeongnam',q:null}]){
  let opened=false;const c=load(['gnOpenOwnerByKey'],{inqCtlIsAdmin:()=>scenario.admin,inqCtlFind:()=>scenario.q,itemOwnerTeam:()=>scenario.team,inqKey:x=>x.id,GN_INQ_CACHE:[],gnOpenOwner:()=>opened=true});
  c.gnOpenOwnerByKey('q');assert.equal(opened,false);assert.equal(c.GN_INQ_CACHE.length,0);
 }
});
test('branch owner entry uses inquiry identity, not unrelated list filters',()=>{
 for(const filter of [{brand:'다른 브랜드',q:''},{brand:'전체',q:'다른 현장'}]){
  const q={id:'branch',brand:'POUR솔루션',assignee:'경남지사'};let opened=-1;
  const c=load(['gnScope','gnOpenOwnerByKey'],{G:filter,itemOwnerTeam:()=> 'gyeongnam',workMatches:()=>true,inqCtlIsAdmin:()=>true,inqCtlFind:()=>q,inqKey:x=>x.id,GN_INQ_CACHE:[],gnOpenOwner:i=>opened=i});
  assert.equal(c.gnScope(q),false,'list filtering remains active');
  c.gnOpenOwnerByKey('branch');assert.equal(opened,0,'an explicitly opened branch inquiry must still allow real-owner assignment');
 }
});
