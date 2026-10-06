/* 파이프라인 단계별 화면 · '확인할 현장' 목록 줄 v11 (2026-10-06 design_handoff_pipeline_v11 · 시안 '컨설팅 설계 목록 v11.dc.html')
   목록 줄만 바꾼다 — 위 필터 · 상태 4칸 · 왼쪽 단계 진단 · 왜 멈춰 있나 · 그래서 뭘 해야 하나 · 리스트/보드 전환은 그대로(pipeline-stage-v3.js · 수주 · 실주는 pipeline-stage-b.js).
   줄 = 4칸: 현장 · 담당(현장명 / 브랜드 색 글자 · 공종 · 담당 — 미배정은 빨강) | 현재 상황(한 줄 상태 / 최근 연락 YYYY.M.D · 연락 기록 없음)
            | 다음 업무 · 기한(업무 / n일 지남(빨강) · 오늘까지 · 내일까지 · M/D까지 · 기한 없음 · 정하기) | 흰 버튼 1개(업무 동사). 위에 칸 이름 줄 · 왼쪽 3px 브랜드 띠.
   줄을 누르면 그 줄 아래 펼침(한 번에 한 줄): 접수일 · 유입 경로 · 연락처 · 단계 진입 후 n일 · 공사 예정 · 결정 상황 · AI 추천 근거 (+ 금액 · 영업건 번호) + [전화] [상세 열기 ↗].
   정렬 = 기한 급한 순(지난 것 → 오늘 → 가까운 날 → 기한 없음). 강조색은 기한 지남 · 미배정의 빨강 하나.
   숫자 · 글은 전부 자료에서(단계 필드 · 다음 할 일 · 접촉 기록 · 연락처). '추천 근거'는 기록에 있는 사실(같은 단지 수주 이력 · 같은 단지 진행 건 · 걸린 사유 · 체류일)만 적는다.
   전 단계(컨설팅 설계 · 자료 발송완료 · 관계관리 · 경쟁·입찰 · 계약·시공 · 수주 · 실주) 같은 줄 구조 — 칸 내용만 그 단계 자료. 끄기: G.pipeRowV11Off=true → 예전 줄 */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const SRC={outbound:'아웃바운드',referral:'소개',re_sales:'기존 고객 재영업',other:'현장 발굴 · 기타'};
 const on=()=>!root.G.pipeRowV11Off;
 const patchOf=d=>{try{return root.itemPatch(d,'deal')||{};}catch(e){return {};}};
 const ctxOf=d=>d.stage_contexts||patchOf(d).stage_contexts||{};
 const ctxVals=(cx,k)=>Object.keys(cx).map(c=>cx[c]&&cx[c].fields&&cx[c].fields[k]).filter(v=>v!=null&&v!=='');
 const dayNum=v=>{if(!v)return null;const n=root.daysTo(String(v).slice(0,10));return Number.isFinite(n)?n:null;};
 const ymdDot=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v||''));return m?+m[1]+'.'+(+m[2])+'.'+(+m[3]):'';};
 const md=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v||''));return m?(+m[2])+'/'+(+m[3]):'';};
 const money=v=>{const n=Number(v)||0;if(!n)return '금액 미정';if(n>=1e8)return (Math.round(n/1e7)/10)+'억';if(n>=1e4)return Math.round(n/1e4).toLocaleString('ko-KR')+'만';return n.toLocaleString('ko-KR');};
 const workOf=r=>{let w='';try{w=root.dealWorkSummary(r.item)||'';}catch(e){}return !w||/미분류|미기록|미입력/.test(w)?'공종 미분류':w;};
 const noOf=r=>'#'+String(r.item.id||r.key||'').replace(/[^0-9a-z]/gi,'').slice(-6);
 const srcOf=d=>{const lf=d.list_fields&&typeof d.list_fields==='object'?d.list_fields:{},v=String(d.source_type||d.sourceType||lf.source_type||d.source||'');return SRC[v]||'인바운드';};
 const contactOf=d=>{try{const c=root.contactInfo(d,patchOf(d))||{};return {name:String(c.name||'').trim(),role:String(c.role||'').trim(),tel:String(c.mobile||c.officeTel||d.office_phone||'').replace(/[^0-9+]/g,'')};}catch(e){return {name:'',role:'',tel:''};}};
 const telFmt=t=>{try{return root.phoneFmt(t)||t;}catch(e){return t;}};
 const planOf=d=>{const t=ctxVals(ctxOf(d),'construction_plan').map(x=>String(x).trim()).filter(Boolean).pop();if(t)return t;let y='';try{y=root.ConstructionYear.valueOf(d).year||'';}catch(e){}return y?y+'년':'';};
 const decisionOf=d=>{const cx=ctxOf(d),a=ctxVals(cx,'decision_maker').concat([d.decision_maker]).map(x=>String(x||'').trim()).filter(x=>x&&x!=='모름').pop()||'',b=ctxVals(cx,'customer_reaction').concat(ctxVals(cx,'reaction'),[d.customer_reaction]).map(x=>String(x||'').trim()).filter(Boolean).pop()||'';return [a,b].filter(Boolean).join(' · ');};
 /* 같은 단지의 지난 수주(가장 최근) — 근거 한 줄 */
 const wonAt=d=>{try{const sid=String(d.cleanup_site_id||d.site_id||d.siteId||'');if(!sid)return '';const w=((root.B&&root.B.deals)||[]).filter(x=>String(x.id)!==String(d.id)&&String(x.cleanup_site_id||x.site_id||x.siteId||'')===sid&&root.isWon(x)).map(x=>String(x.contract_date||x.closed_at||'').slice(0,7)).sort().pop();return w===undefined?'':w;}catch(e){return '';}};
 /* 최근 연락 = 연락을 시도한 기록까지 포함(부재 · 문자 발송도 연락한 날이다). 기록이 없으면 그 줄의 마지막 접촉일 */
 const TOUCH=['전화','문자','카카오','카톡','방문','이메일','메일','통화'];
 const lastTouch=r=>{let best=String(r.last||'').slice(0,10);try{(Array.isArray(r.item.activities)?r.item.activities:[]).forEach(a=>{const t=String(a&&a.type||''),at=String(a&&(a.at||a.occurred_at)||'').slice(0,10);if(at&&TOUCH.some(k=>t.includes(k))&&at>best)best=at;});}catch(e){}return /^\d{4}-\d{2}-\d{2}/.test(best)?best:'';};
 /* 기록이 없다는 것은 'CRM 에 없다'는 뜻이다(연락을 안 했다고 단정하지 않는다 — 2026-10-05 정합성 ①) */
 const NOLOG='CRM 연락 기록 없음';
 const dueText=(n,due)=>n==null?'기한 없음 · 정하기':n<0?(-n)+'일 지남':n===0?'오늘까지':n===1?'내일까지':md(due)+'까지';
 /* 기한 급한 순: 지난 것(많이 지난 순) → 오늘 → 가까운 날 → 기한 없음. 같은 기한은 넘겨받은 순서 그대로 */
 function sort(list,rowOf){
  return list.map((x,i)=>{const r=rowOf(x),n=r&&r.due?dayNum(r.due):null;return {x,i,n:n==null?1e9:n};}).sort((a,b)=>a.n-b.n||a.i-b.i).map(o=>o.x);
 }
 const head=()=>'<div class="prv-head" role="row"><span>현장 · 담당</span><span>현재 상황</span><span>다음 업무 · 기한</span><span></span></div>';
 /* o = {r(행), now(한 줄 상태), task(다음 업무 — 등록된 다음 할 일이 없을 때), btn[이름, 동작], stall, goal, reasons[걸린 사유 이름], dup(같은 단지 진행 건 문장), closed(수주 · 실주), amountLabel}
    ns = 그 화면의 누름 속성 이름(ps3 · psb), cls = 그 화면의 줄 클래스(예전 선택자 유지) */
 function row(o,open,ns,cls){
  const r=o.r,d=r.item,bc=BRAND[d.brand]||'',c=contactOf(d),owner=String(r.owner||'').trim(),noOwner=!o.closed&&(!owner||owner==='미배정');
  const due=r.due?dayNum(r.due):null,hasNext=!!(r.next&&r.next.text);
  let btn=o.btn||['열기',''];const contactAct=btn[1]==='next'||btn[1]==='activity';
  if(noOwner)btn=['담당 배정','owner'];else if(!o.closed&&contactAct&&!c.tel)btn=['연락처 찾기','contact'];
  const now=noOwner?'담당자 미지정':(o.now||'');
  const task=noOwner?'담당자 배정':hasNext?String(r.next.text).trim():(o.task||''),lt=lastTouch(r),last=lt?'최근 연락 '+ymdDot(lt):NOLOG;
  const key=attr(r.key),A='data-'+ns;
  let more='';
  if(open){
   const who=[c.name&&c.role&&!c.name.includes(c.role)?c.name+' '+c.role:(c.name||c.role),c.tel?telFmt(c.tel):'번호 없음'].filter(Boolean).join(' · '),wy=wonAt(d),plan=planOf(d),dec=decisionOf(d);
   const why=[wy?'기존 고객('+wy.slice(0,4)+'.'+Number(wy.slice(5))+' 수주) · 지난 공사 안부로 시작':'',o.dup||''].concat(o.reasons||[]).filter(Boolean);
   const amt=Number(r.amount)||0;
   const items=[['접수일',ymdDot(d.created||d.created_at),''],['유입 경로',srcOf(d),''],['연락처',c.name||c.role||c.tel?who:'',c.tel?'':'g'],['단계 진입 후',o.stall!=null?o.stall+'일':'',o.goal&&o.stall>o.goal?'r':''],['공사 예정',plan,''],['결정 상황',dec,''],['AI 추천 근거',why.join(' · '),''],[o.amountLabel||'예상 금액',amt?money(amt):'',''],['영업건 번호',noOf(r),'']];
   more='<div class="prv-more">'+items.map(m=>'<div><span>'+h(m[0])+'</span><b class="'+(m[1]?m[2]:'g')+'">'+h(m[1]||(m[0]==='연락처'?'연락처 없음':m[0]==='AI 추천 근거'?'특이 사항 없음':m[0].indexOf('금액')>=0?'금액 미정':'미확인'))+'</b></div>').join('')
    +'<div class="prv-foot">'+(c.tel?'<a href="tel:'+attr(c.tel)+'" '+A+'="call">전화 '+h(telFmt(c.tel))+'</a>':'<button type="button" disabled>전화번호 없음</button>')+'<button type="button" '+A+'="detail" data-key="'+key+'">상세 열기 ↗</button></div></div>';
  }
  return '<div class="prv-row '+(cls||'')+(open?' open':'')+'" data-key="'+key+'"'+(o.tab!=null?' data-tab="'+attr(o.tab)+'"':'')+' style="border-left-color:'+(bc||'#e3e6ec')+'">'
   +'<div class="prv-main" role="row" tabindex="0" '+A+'="toggle" data-key="'+key+'" aria-expanded="'+!!open+'">'
   +'<div class="prv-a"><b title="'+attr(r.site)+'">'+h(r.site)+(root.advisoryBadge?root.advisoryBadge(d):'')+'</b><span><em style="color:'+(bc||'#9ca3af')+'">'+h(d.brand||'브랜드 미지정')+'</em> · '+h(workOf(r))+' · <i'+(noOwner?' class="r"':'')+'>'+h(owner||'미배정')+'</i></span></div>'
   +'<div class="prv-b"><span title="'+attr(now)+'">'+h(now)+'</span><small>'+h(last)+'</small></div>'
   +'<div class="prv-c"><b'+(task?'':' class="none"')+' title="'+attr(task)+'">'+h(task||'다음 업무 없음')+'</b><small class="'+(due!=null&&due<0?'r':due==null?'g':'')+'">'+h(dueText(due,r.due))+'</small></div>'
   +'<button type="button" '+A+'="act" data-key="'+key+'" data-v="'+attr(btn[1])+'">'+h(btn[0])+'</button></div>'+more+'</div>';
 }
 root.PipelineRowV11={on,head,row,sort,dueText};
})(window);
