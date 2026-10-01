/* 주소 동기화 (2026-10-01 컨설턴트 P1-11 — 상세를 열어도 주소가 그대로라 뒤로가기로 앱 밖으로 나가고, 링크 공유가 안 됐다)
   화면(page)·영업 상세(deal)·문의 상세(inq)를 iframe 주소의 해시(#p=…&deal=…)에 적고, 뒤로가기(popstate)로 같은 화면을 복원한다.
   바깥 index.html에는 postMessage로 알려 주소창에도 같은 해시가 보이게 한다. 저장·전송 동작은 건드리지 않는다. */
(function(root){
 'use strict';
 const SAFE=/^[\w가-힣|:.\-]{1,120}$/;
 let applying=false,last='';
 function page(){const p=String(root.G?.page||'');return root.TITLES&&root.TITLES[p]?p:'';}
 function dealOpen(){const c=root.CUR_DETAIL;return root.G?._detailPopup&&c&&c.kind==='deal'&&document.getElementById('detailView')?.classList.contains('on')?String(c.key||''):'';}
 function inqOpen(){return document.getElementById('inq-inbox-dialog')?String(root.G?.inqSelKey||''):'';}
 function current(){const p=page();if(!p)return '';const d=dealOpen(),q=inqOpen();return '#p='+p+(d&&SAFE.test(d)?'&deal='+encodeURIComponent(d):'')+(q&&SAFE.test(q)?'&inq='+encodeURIComponent(q):'');}
 function parse(hash){const out={};String(hash||'').replace(/^#/,'').split('&').forEach(kv=>{const i=kv.indexOf('=');if(i<0)return;const k=kv.slice(0,i),v=decodeURIComponent(kv.slice(i+1));if(['p','deal','inq'].includes(k)&&SAFE.test(v))out[k]=v;});return out;}
 function tellParent(hash){try{if(root.parent&&root.parent!==root)root.parent.postMessage({type:'nf:hash',hash},location.origin);}catch(e){}}
 function sync(){
  if(applying)return;const h=current();if(!h||h===last)return;
  try{if(!last||location.hash===''||!location.hash)history.replaceState(null,'',h);else history.pushState(null,'',h);}catch(e){}
  last=h;tellParent(h);
 }
 function apply(hash){
  const want=parse(hash);if(!want.p||!root.TITLES?.[want.p]||!root.B)return;
  applying=true;
  try{
   if(inqOpen()&&!want.inq&&root.InquiryWorkbench?.dismiss)root.InquiryWorkbench.dismiss();
   if(dealOpen()&&!want.deal&&typeof root.closeDetail==='function')root.closeDetail();
   if(page()!==want.p&&typeof root.goPage==='function')root.goPage(want.p);
   if(want.deal&&dealOpen()!==want.deal){const d=(root.B.deals||[]).find(x=>root.dealKey(x)===want.deal);if(d)root.drwDeal(JSON.stringify(d));}
   if(want.inq&&inqOpen()!==want.inq&&root.InquiryWorkbench?.open){const q=root.inqCtlFind?.(want.inq,false);if(q)root.InquiryWorkbench.open(want.inq);}
  }finally{applying=false;}
  last=current();tellParent(last);
 }
 function wrap(name){const fn=root[name];if(typeof fn!=='function')return;root[name]=function(){const r=fn.apply(this,arguments);setTimeout(sync,0);return r;};}
 function wrapObj(obj,name){const fn=obj&&obj[name];if(typeof fn!=='function')return;obj[name]=function(){const r=fn.apply(this,arguments);setTimeout(sync,0);return r;};}
 function boot(){
  ['goPage','nav','drwDeal','drwInq','closeDetail','closeDrw'].forEach(wrap);
  ['open','close','dismiss','openFrom'].forEach(n=>wrapObj(root.InquiryWorkbench,n));
  root.addEventListener('popstate',()=>apply(location.hash));
  /* 처음 들어올 때 해시가 있으면(공유 링크) 자료가 준비된 뒤 그 화면을 연다 */
  const initial=location.hash;let tries=0;
  (function wait(){if(root.B&&(root.B.deals||[]).length){if(initial&&initial!==current())apply(initial);else sync();return;}if(++tries<120)setTimeout(wait,500);})();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.PCRouter={sync,apply,current,parse};
})(window);
