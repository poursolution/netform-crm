/* 단계 바로 옮기기(2026-11-10 대표 피드백 ③ "단계 넘기는 거 심플하지 못함" → B 진행)
   왜: 정착 모드(11/9)로 대부분 단계에 꼭 채울 칸이 없어졌는데도, 단계를 고르면 창이 열리고 [옮기기]를 한 번 더 눌러야 했다.
   무엇: PC 영업건 상세에서 옮길 단계를 고를 때, 그 단계에 꼭 채울 칸이 없고 화면이 미리 채운 값으로 검사를 통과하면
         창을 열지 않고 아래 알림을 띄운 뒤 4초 뒤에 같은 단계 변경 저장 길(StageTransitionUI.autoMove)로 옮긴다.
         알림의 [되돌리기]를 누르면 아무것도 저장하지 않는다(4초 안). [입력하고 옮기기]를 누르면 예전처럼 창을 연다.
         다음 할 일이 없으면 '3일 후'(창의 날짜 칩과 같은 값)로 등록하고 알림에 그 날짜를 적는다.
   그대로 창을 여는 것: 수주 · 실주 · 배드핏 · 연락두절 · 지원 종결 · 보류(대기) · 과거 이관 건 · 꼭 채울 칸이 있는 단계(계약 · 시공 · 준공의 금액 · 날짜) · 미리 채운 값으로 검사가 안 되는 경우 · 모바일.
   끄기: G.quickMoveOff = true */
(function(root){
 'use strict';
 const DELAY=4000;
 const SKIP=new Set(['won','lost','badfit_lead','badfit','badfit_pipe','nocontact','support','waiting']);
 let pending=null;
 const off=()=>!!(root.G&&root.G.quickMoveOff);
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const md=k=>{const m=/^\d{4}-(\d{2})-(\d{2})$/.exec(String(k||''));return m?Number(m[1])+'/'+Number(m[2]):'';};
 function legacy(d){try{const P=root.PipelineScope;return !!(P&&P.on()&&P.isLegacy(d));}catch(e){return false;}}
 /* 옮길 수 있으면 {input, label, next} · 아니면 null */
 function plan(d,to){
  const UI=root.StageTransitionUI;if(off()||!d||!to||SKIP.has(to)||legacy(d)||!UI||typeof UI.quickPlan!=='function'||typeof UI.autoMove!=='function')return null;
  try{const p=UI.quickPlan(d,to);return p&&p.ok?p:null;}catch(e){return null;}
 }
 function box(){
  let b=document.getElementById('qm-toast');
  if(!b){b=document.createElement('div');b.id='qm-toast';b.setAttribute('role','status');b.setAttribute('aria-live','polite');
   b.style.cssText='position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:10050;display:flex;align-items:center;gap:10px;max-width:calc(100vw - 32px);padding:10px 12px 10px 16px;border-radius:12px;background:#15171c;color:#fff;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.18)';
   document.body.append(b);}
  return b;
 }
 function hide(){const b=document.getElementById('qm-toast');if(b)b.remove();}
 function commit(){
  const p=pending;if(!p)return;pending=null;clearTimeout(p.timer);hide();
  let r=null;try{r=root.StageTransitionUI.autoMove(p.d,p.to,p.input);}catch(e){r={ok:false,errors:[String(e&&e.message||e)]};}
  if(!r||!r.ok){/* 저장 직전 검사에서 막히면 예전처럼 창을 연다 */try{root.StageTransitionUI.open(p.d,false,p.to,{full:true});}catch(e){}return;}
  try{if(root.DetailActions&&root.DetailActions.active==='stage')root.DetailActions.close();}catch(e){}
  try{if(typeof root.renderDetail==='function'&&root.CUR_DETAIL&&root.CUR_DETAIL.item===p.d)root.renderDetail();}catch(e){}
  try{if(typeof root.toast==='function')root.toast(p.label+'(으)로 옮겼습니다');}catch(e){}
 }
 function cancel(){const p=pending;if(!p)return;pending=null;clearTimeout(p.timer);hide();try{if(typeof root.toast==='function')root.toast('옮기지 않았습니다');}catch(e){}}
 function full(){const p=pending;if(!p)return;pending=null;clearTimeout(p.timer);hide();try{root.StageTransitionUI.open(p.d,false,p.to,{full:true});}catch(e){}}
 /* 바로 옮기기 시작 — 다루면 true(창을 열지 않음) */
 function start(d,to){
  if(pending)commit();/* 앞의 것은 바로 저장 */
  const p=plan(d,to);if(!p)return false;
  pending={d,to,input:p.input,label:p.label,timer:setTimeout(commit,DELAY)};
  const b=box();
  b.innerHTML='<span>'+esc(p.label)+'(으)로 옮깁니다'+(p.next?' · 다음 할 일 '+esc(md(p.next.due))+' '+esc(p.next.text):'')+'</span>'
   +'<button type="button" data-qm="undo" style="border:0;border-radius:8px;padding:6px 10px;background:#fff;color:#15171c;font:inherit;font-weight:700;cursor:pointer">되돌리기</button>'
   +'<button type="button" data-qm="full" style="border:1px solid rgba(255,255,255,.4);border-radius:8px;padding:6px 10px;background:transparent;color:#fff;font:inherit;cursor:pointer">입력하고 옮기기</button>';
  b.querySelector('[data-qm="undo"]').onclick=cancel;b.querySelector('[data-qm="full"]').onclick=full;
  return true;
 }
 /* 창 열기를 감싼다 — 사용자가 옮길 단계를 직접 고른 경우(to 가 있음 · PC)만. {full:true} 면 예전처럼 창 */
 function install(){
  const UI=root.StageTransitionUI;if(!UI||UI.__qm)return;const base=UI.open;
  UI.open=function(d,mobile,to,opt){if(!mobile&&to&&!(opt&&opt.full)&&start(d,to))return;return base.call(this,d,mobile,to);};
  UI.__qm=true;
 }
 root.addEventListener('pagehide',()=>{if(pending)commit();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
 root.QuickMove={plan,start,commit,cancel,pending:()=>pending?{to:pending.to,label:pending.label}:null,install};
})(window);
