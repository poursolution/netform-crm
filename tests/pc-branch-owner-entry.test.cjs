const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../crm.html'),'utf8');
function load(names,ctx){vm.createContext(ctx);for(const name of names){const line=source.split('\n').find(x=>x.startsWith('function '+name+'('));assert.ok(line,name);vm.runInContext(line,ctx);}return ctx;}
test('branch detail opens existing real-owner dialog without changing consultant',()=>{
 const q={id:'test',assignee:'경남지사',consultant_name:'상담 직원'};let opened;
 const c=load(['gnOpenOwnerByKey'],{inqCtlIsAdmin:()=>true,inqCtlFind:()=>q,gnScope:()=>true,inqKey:x=>x.id,GN_INQ_CACHE:[],gnOpenOwner:i=>opened=i});
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
