/* 영업건 휴지통 (2026-10-07 대표 "휴지통에 보관하고 30일 뒤 삭제")
   서버: crm_deal_trash_list_v1(목록 · 부를 때마다 30일 지난 것 삭제) · crm_deal_restore_v1(복원) — sql/deal-trash-v1-20261007.sql. 관리자만.
   보내기는 deal-discard.js(상세 [···] → [휴지통으로 보내기]). 이 모듈은 목록 창(과거 이관 화면 머리 [휴지통]) · [복원].
   서버 함수가 허용 목록 · 운영에 없으면 단추가 나오지 않는다(CRMRelease). 한 쪽 20건(서버 쪽 번호). */
(function(root){
 'use strict';
 const RPC={list:'crm_deal_trash_list_v1',restore:'crm_deal_restore_v1'};
 const admin=()=>{try{return !!root.inqCtlIsAdmin();}catch(e){return false;}};
 const h=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const toast=(m,k)=>{if(typeof root.toast==='function')root.toast(m,k);};
 const has=n=>(root.CRM_RPC_ALLOW||[]).includes(n)&&!(root.CRMRelease&&root.CRMRelease.has&&root.CRMRelease.has(n)===false);
 const ready=()=>!!(root.SB&&typeof root.SB.rpc==='function'&&root.TOKEN)&&has(RPC.list)&&has(RPC.restore)&&admin();
 const S={open:false,busy:false,page:1,data:null,err:'',restoring:''};
 async function rpc(name,p){
  const r=await root.SB.rpc(name,{p:p||{}});
  if(r&&r.error){if(r.error.code==='PGRST202'||/Could not find the function/i.test(String(r.error.message||''))){try{root.CRMRelease.noteMissing(name);}catch(e){}throw Error('휴지통 기능이 아직 서버에 적용되지 않았습니다');}throw Error(r.error.message||'서버 오류');}
  if(!r||!r.data||r.data.ok!==true)throw Error('서버 확인 응답이 올바르지 않습니다');
  return r.data;
 }
 async function load(page){
  if(!ready())return;S.busy=true;S.err='';if(page)S.page=page;render();
  try{S.data=await rpc(RPC.list,{page:S.page});}catch(e){S.err=String(e&&e.message||e);}
  S.busy=false;render();
 }
 const md=v=>{try{const x=new Date(v);return v&&!isNaN(x)?x.getFullYear()+'.'+(x.getMonth()+1)+'.'+x.getDate():'';}catch(e){return '';}};
 const stageName=c=>{try{if(root.PipelineScope&&root.PipelineScope.OLD[c])return root.PipelineScope.OLD[c];if(root.STAGE_MASTER&&root.STAGE_MASTER[c])return root.stageLabel(c);}catch(e){}return c||'단계 없음';};
 function rowHtml(i){
  const left=Number(i.days_left)||0,urgent=left<=7;
  /* 현장 이름이 비어 있거나 브랜드 이름과 같으면 목록과 같은 꼴 '영업기회 · 끝 6자리' */
  const site=(i.site&&String(i.site).trim()&&String(i.site).trim()!==String(i.brand||'').trim())?i.site:'영업기회 · '+String(i.deal_id||'').slice(-6);
  return '<div class="dtr-row'+(urgent?' urgent':'')+'" role="row">'
   +'<div class="dtr-a"><b>'+h(site)+'</b><span>'+h(i.brand||'브랜드 미지정')+(i.created?' · 예전 등록 '+h(md(i.created)):'')+'</span></div>'
   +'<div class="dtr-b"><b>'+h(stageName(i.stage_code))+'</b><span>담당 '+h(i.owner||'없음')+(i.child_rows?' · 함께 보관 '+h(i.child_rows)+'건':'')+'</span></div>'
   +'<div class="dtr-c"><b>'+h(md(i.trashed_at))+' '+h(i.by||'')+'</b><span>'+h(i.reason||'')+'</span></div>'
   +'<div class="dtr-d"><b>'+(left?'남은 '+left+'일':'오늘 삭제')+'</b><span>'+h(md(i.expires_at))+' 자동 삭제</span></div>'
   +'<button type="button" data-dtr="restore" data-id="'+h(i.deal_id)+'"'+(S.restoring?' disabled':'')+'>'+(S.restoring===String(i.deal_id)?'복원 중…':'복원')+'</button></div>';
 }
 function html(){
  const D=S.data,total=D?Number(D.total)||0:0,per=D?Number(D.per)||20:20,pages=Math.max(1,Math.ceil(total/per)),items=D?D.items||[]:[];
  let body;
  if(S.err)body='<p class="dtr-empty dtr-err">'+h(S.err)+'</p>';
  else if(S.busy&&!D)body='<p class="dtr-empty">불러오는 중…</p>';
  else if(!items.length)body='<p class="dtr-empty">휴지통이 비어 있습니다</p>';
  else body='<div class="dtr-list" role="table" aria-label="휴지통"><div class="dtr-head" role="row"><span>현장 · 브랜드</span><span>단계 · 담당</span><span>보낸 날 · 보낸 사람 · 사유</span><span>자동 삭제</span><span></span></div>'+items.map(rowHtml).join('')+'</div>';
  let pager='';
  if(pages>1){let a=Math.max(1,S.page-2),b=Math.min(pages,a+4);a=Math.max(1,b-4);const btn=(n,t,dis,on)=>'<button type="button" data-dtr="page" data-page="'+n+'"'+(dis?' disabled':'')+(on?' aria-current="page"':'')+'>'+t+'</button>';
   pager='<nav class="dtr-pager" aria-label="쪽">'+btn(S.page-1,'‹',S.page<=1);for(let n=a;n<=b;n++)pager+=btn(n,String(n),false,n===S.page);pager+=btn(S.page+1,'›',S.page>=pages)+'<span>'+total.toLocaleString('ko-KR')+'건 · '+per+'건씩</span></nav>';}
  return '<div class="dtr" role="dialog" aria-modal="true" aria-label="휴지통"><div class="dtr-hd"><b>휴지통</b><span class="n">'+total.toLocaleString('ko-KR')+'건</span><span class="dtr-note">보낸 날부터 30일 보관 · 그 뒤 자동 삭제 · 복원하면 응대 기록까지 그대로 돌아옵니다</span><i></i>'
   +'<button type="button" class="lnk" data-dtr="reload"'+(S.busy?' disabled':'')+'>다시 불러오기</button><button type="button" class="dtr-x" data-dtr="close" aria-label="닫기">✕</button></div>'+body+pager+'</div>';
 }
 function render(){
  let w=document.getElementById('dealTrash');
  if(!S.open){if(w)w.remove();return;}
  if(!w){w=document.createElement('div');w.id='dealTrash';w.className='dtr-wrap';document.body.append(w);}
  w.innerHTML=html();
 }
 function open(){if(!ready()){toast('휴지통은 관리자만 열 수 있습니다','warn');return;}S.open=true;S.page=1;S.data=null;S.err='';render();load(1);}
 function close(){S.open=false;render();}
 async function restore(id){
  if(!ready()||S.restoring)return;
  const it=(S.data&&S.data.items||[]).find(x=>String(x.deal_id)===String(id));
  if(!root.confirm('이 자료를 복원할까요?\n\n'+String(it&&it.site||'')+'\n영업건과 함께 보관한 응대 기록이 그대로 돌아옵니다.'))return;
  S.restoring=String(id);render();
  try{const r=await rpc(RPC.restore,{deal_id:String(id)});toast('복원했습니다'+(r.child_rows?' · 기록 '+r.child_rows+'건 포함':'')+' — 자료를 다시 불러옵니다');S.restoring='';await load(S.page);try{if(typeof root.loadData==='function')root.loadData();}catch(e){}}
  catch(e){S.restoring='';toast(String(e&&e.message||e),'warn');render();}
 }
 document.addEventListener('click',e=>{
  const w=document.getElementById('dealTrash');if(!w)return;
  const b=e.target.closest('#dealTrash [data-dtr]');
  if(!b){if(e.target===w)close();return;}
  const a=b.dataset.dtr;if(b.disabled)return;
  if(a==='close')return close();
  if(a==='reload')return load(S.page);
  if(a==='page')return load(Number(b.dataset.page)||1);
  if(a==='restore')return restore(b.dataset.id);
 },true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.open){close();}},true);
 root.DealTrash={RPC,ready,open,close,load,restore,state:()=>S};
})(window);
