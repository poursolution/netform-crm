/* 영업 판단 · 준비 지원 (2026-10-10 design_handoff_rules 6차 · 시안 '영업 판단 · 준비 지원 시안.dc.html')
   영업건 상세 오른쪽 칸: 협업 상자(.dcb) · 관리 단위 상자(.dvu) 아래에 상자 하나(.dp6) + '지금 할 일' 카드에 5줄(.dp6-plan).
   '연락' 한 줄로 끝내지 않는다 — 무엇이 미확인이고, 어떤 지원이 필요하고, 준비가 어디까지 됐는지를 같이 본다.
   0 지금 할 일 5줄(미확인 · 필요 지원 · 담당자 행동 · 내부 지원 · 준비 완료 조건)
   1 영업 진행 조건 5가지(예산 · 추진 시기 · 공사 범위 · 결정 절차 · 경쟁 여부) = 고객 확인 / 담당 추정 / 미확인 — 추정은 판단 근거로 세지 않는다
   2 의사결정자 · 관계자(등록된 연락처의 역할 · 결정 영향 — 연락처 ≠ 결정권자)
   3 입찰 준비 체크 5항목(경쟁 · 입찰 단계만) — 준비 완료 ≠ 제출 완료
   4 내부 지원 요청(원인 5가지 → 받는 사람 · 요청 · 필요일) — 요청 엔진(WorkRequest · kind support)과 기존 '[지원 요청]' 메모(관리자 지원 대기 목록이 읽는다)
   5 단계 변경 이력(단계 · 일시 · 변경자 · 근거 · 이관 전 날짜는 '실제 진입일 미확인')
   6 방문 전 요약(다음 업무가 방문 · 미팅일 때) + 같은 날 확정 일정 충돌(시각은 저장되지 않아 날짜까지)
   7 예상 수주일 변경(이전 → 새 날짜 · 변경자 · 사유 · 2회 이상 연기 = '가능성 낮음')
   저장은 기존 길만: 내부 메모 한 줄(DealDetailV3.memo) — 머리 표식 '[진행 조건] 항목 | 상태 | 값' · '[입찰 준비] 항목 | 완료·해제' · '[지원 요청] …' · '[예상 수주일] 이전 | 새 | 사유'.
   새 서버 함수 · 새 칸 없음(협업 상자 decision-collab.js 와 같은 방식 — 고칠 때마다 한 줄씩 쌓여 이력이 남는다). 끄기: G.dealPrepOff=true */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const on=()=>!(R.G&&R.G.dealPrepOff)&&!!(R.DealDetailV3&&R.DealDetailV3.memo);
 const SS=()=>R.G.dealPrep||(R.G.dealPrep={}),st=d=>SS()[d.id]||(SS()[d.id]={edit:'',draft:{},sup:null,exp:null,busy:false,err:'',pg:1});
 const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'});
 const dayKey=v=>{try{const J=R.PipelineJudge,k=J&&J.dayKey?J.dayKey(v):'';if(k)return k;}catch(e){}const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v||''));return m?m[0]:'';};
 const md=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?(+m[2])+'.'+(+m[3]):'';};
 const dot=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?(+m[1])+'.'+(+m[2])+'.'+(+m[3]):'';};
 const cut=(v,n)=>{v=String(v||'').replace(/\s+/g,' ').trim();return v.length>n?v.slice(0,n-1)+'…':v;};
 const patchOf=d=>{try{return R.itemPatch(d,'deal')||{};}catch(e){return {};}};
 const codeOf=d=>{try{return String(R.dealStage(d)||'');}catch(e){return String(d.stage_code||d.code||'');}};
 const acts=d=>{const seen=new Set();return [].concat(d.activities||[],patchOf(d).activities||[]).filter(a=>{if(!a||!a.note)return false;const k=a.id||String(a.at||a.occurred_at)+'|'+String(a.note).slice(0,40);if(seen.has(k))return false;seen.add(k);return true;}).map(a=>({note:String(a.note),type:String(a.type||''),at:String(a.at||a.occurred_at||a.created_at||''),actor:String(a.actor||a.actor_name||'')})).sort((a,b)=>a.at.localeCompare(b.at));};
 const parts=s=>String(s).split('|').map(x=>x.trim());
 const ctx=d=>d.stage_contexts||patchOf(d).stage_contexts||{};
 const anyF=(d,k)=>{const c=ctx(d);let v='';Object.keys(c).some(s=>{const x=c[s]&&c[s].fields&&c[s].fields[k];if(x!=null&&x!==''&&!(Array.isArray(x)&&!x.length)){v=Array.isArray(x)?x.join(' · '):String(x);return true;}return false;});return v;};
 const meName=()=>{try{return R.repN(R.ME&&R.ME.name)||'';}catch(e){return '';}};
 const COND=['예산','추진 시기','공사 범위','결정 절차','경쟁 여부'],CST=['고객 확인','담당 추정','미확인'];
 const BID=['공고 확인 · 입찰 방식','현장설명회 참석','필수 서류 (사업자 · 실적 · 시방서)','제안서 · 공법 비교표','제출 방법 · 접수증'];
 const CAUSE=[['가격 검토','경쟁 가격대 대비 할인 가능 범위'],['기술 검토','공법 비교자료 검토'],['자료 제작','제안서 · 시공 사례 제작'],['동행 필요','미팅 · PT 동행'],['결정권자 접촉','결정권자 미팅 주선']];
 const BIDSTAGE=['compete','bidding','imminent'];
 /* ── 읽기: 메모 표식에서(마지막 줄이 지금 값) ── */
 function read(d){
  const out={cond:{},bid:{},sup:[],exp:[]};if(!d)return out;
  acts(d).forEach(a=>{const n=a.note.replace(/\s*\[연결 [^\]]*\]/g,'');let m;
   if((m=/^\[진행 조건\]\s*(.*)$/.exec(n))){const p=parts(m[1]);if(COND.includes(p[0]))out.cond[p[0]]={st:CST.includes(p[1])?p[1]:'미확인',v:p[2]||'',at:dayKey(a.at),by:a.actor};return;}
   if((m=/^\[입찰 준비\]\s*(.*)$/.exec(n))){const p=parts(m[1]);if(BID.includes(p[0]))out.bid[p[0]]={done:p[1]==='완료',at:dayKey(a.at),by:a.actor};return;}
   if((m=/^\[지원 요청\]\s*(.*)$/.exec(n))){out.sup.push({text:m[1],at:dayKey(a.at)});return;}
   if((m=/^\[예상 수주일\]\s*(.*)$/.exec(n))){const p=parts(m[1]);out.exp.push({from:p[0]||'',to:p[1]||'',why:p[2]||'',at:dayKey(a.at),by:a.actor});}
  });
  return out;
 }
 /* 기록에 이미 있는 값(출처 표시 전) — 상태는 '미확인'으로 둔다. 값이 있다고 고객 확인으로 치지 않는다 */
 const hint=(d,k)=>k==='추진 시기'?(anyF(d,'construction_plan')||anyF(d,'expected_timing')):k==='공사 범위'?anyF(d,'work_scope'):k==='경쟁 여부'?(anyF(d,'competitor')||anyF(d,'competition_flag')||String(d.competitor||'')):k==='결정 절차'?anyF(d,'board_meeting'):'';
 function conds(d,L){L=L||read(d);return COND.map(k=>{const c=L.cond[k],hv=c?'':hint(d,k);return {k,st:c?c.st:'미확인',v:c?c.v:hv,src:c?[md(c.at),c.by].filter(Boolean).join(' · '):hv?'기록에 있는 값 · 출처 표시 전':'근거 없음'};});}
 /* ── 2 관계자: 등록된 연락처(역할 · 결정 영향) ── */
 function people(d){
  const L=[].concat(Array.isArray(d.contacts)?d.contacts:[],Array.isArray(patchOf(d).contacts)?patchOf(d).contacts:[]),seen=new Set(),kp=patchOf(d).keyPerson||{};
  const infl=c=>{const t=String(c.decision_role||c.influence_level||'').trim(),key=String(c.person_key||c.personKey||'');if(kp[key])return '최종 결정';if(/최종|결정권|decider|final/i.test(t))return '최종 결정';if(/영향|검토|influenc/i.test(t))return '영향';if(/아님|없음|none|창구/i.test(t))return '결정 아님';return t||'미확인';};
  const out=L.filter(c=>c&&String(c.name||c.manager_name||'').trim()&&c.status!=='previous').filter(c=>{const k=String(c.person_key||c.personKey||c.name||c.manager_name);if(seen.has(k))return false;seen.add(k);return true;}).map(c=>({name:String(c.name||c.manager_name),role:String(c.role||c.manager_role||'역할 미입력'),infl:infl(c)}));
  if(!out.length){let c={};try{c=R.contactInfo(d,patchOf(d))||{};}catch(e){}if(c.name)out.push({name:c.name,role:c.role||'관리소장',infl:'미확인'});}
  return out;
 }
 /* ── 5 단계 변경 이력 ── */
 function history(d){
  const live=String((R.OPS_RULES||{}).liveFrom||''),seen=new Set();
  return [].concat(d.stageHistory||[],patchOf(d).stageHistory||[]).filter(x=>x&&x.to).map(x=>({to:x.to,at:dayKey(x.at||x.changed_at),who:String(x.actor||x.actor_name||''),why:String(x.reason||'')})).filter(x=>{const k=x.to+'|'+x.at;if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>String(b.at).localeCompare(String(a.at))).map(x=>Object.assign(x,{label:(()=>{try{return R.stageLabel(x.to);}catch(e){return x.to;}})(),legacy:!!live&&!!x.at&&x.at<live&&(!x.who||/시스템|이관|system/i.test(x.who+' '+x.why))}));
 }
 /* ── 6 방문 전 요약 ── */
 const VISIT=/방문|미팅|실측|PT|현설|회의/;
 function visit(d,L){
  let a=null;try{a=R.actionObj(d,patchOf(d));}catch(e){}if(!a||!a.text||!VISIT.test(String(a.type||'')+' '+String(a.text)))return null;
  const day=String(a.due||a.due_at||'').slice(0,10),C=conds(d,L),open=C.filter(c=>c.st!=='고객 확인').map(c=>c.k);
  let promise='';try{const IM=R.InquiryMemo;if(IM&&IM.parse)acts(d).slice().reverse().some(x=>{if(/^\[/.test(x.note))return false;const P=IM.parse(x.note,x.at).promises||[];if(P.length){promise=String(P[0].title||P[0].text||'').trim();return !!promise;}return false;});}catch(e){}
  if(!promise&&/^고객 약속:/.test(String(a.text)))promise=String(a.text).replace(/^고객 약속:\s*/,'');
  const mat=anyF(d,'materials'),sent=anyF(d,'sent_date');
  const clash=[];try{const owner=R.repN(d.assignee)||'';(R.PipelineWorkspace.rows({unscoped:true})||[]).forEach(r=>{if(!r.item||String(r.item.id)===String(d.id)||!r.next||!r.next.text)return;if((r.owner||'')!==owner||String(r.due||'').slice(0,10)!==day)return;if(!VISIT.test(String(r.next.type||'')+' '+String(r.next.text)))return;if(/^고객 약속:/.test(String(r.next.text)))clash.push(String(r.site||''));});}catch(e){}
  return {day,text:String(a.text),rows:[['고객 요구',anyF(d,'needs')||anyF(d,'quote_request')||'기록 없음'],['지난 약속',promise||'기록된 약속 없음'],['미해결',open.length?open.slice(0,3).join(' · ')+(open.length>3?' 외 '+(open.length-3):''):'없음'],['최신 자료',mat?mat+(sent?' · '+md(sent):''):'발송 기록 없음']],clash};
 }
 /* ── 7 예상 수주일 ── */
 function expected(d,L){L=L||read(d);const base=anyF(d,'expected_contract'),list=L.exp.slice(),cur=list.length?list[list.length-1].to:String(base||'').slice(0,10),delays=list.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.from)&&/^\d{4}-\d{2}-\d{2}$/.test(x.to)&&x.to>x.from).length;return {cur,list:list.reverse(),delays,low:delays>=2};}
 /* ── 4 지원 요청: 요청 엔진에 있는 이 영업건의 '내부 지원' + 메모 ── */
 function supports(d,L){
  L=L||read(d);let req=[];try{const W=R.WorkRequest;if(W&&W.enabled())req=(W.state().list||[]).filter(r=>r.target_type==='deal'&&String(r.target_id)===String(d.id)&&/^내부 지원 · /.test(String(r.label||'')));}catch(e){}
  const stOf=r=>r.status==='sent'?'보냄 · 확인 전':r.status==='seen'?'확인함':r.status==='working'?'처리 중':r.status==='replied'||r.status==='done'?'지원 회신'+(r.reply_note?' · '+cut(r.reply_note,30):''):r.status==='cancelled'?'취소':'보냄';
  return {req:req.map(r=>({cause:String(r.label).replace(/^내부 지원 · /,''),to:r.to_name||'',ask:(r.asks||[]).join(' · '),due:dayKey(r.due_at),st:stOf(r),open:['sent','seen','working'].includes(r.status)})),memos:L.sup};
 }
 /* ── 0 지금 할 일 5줄 ── */
 function plan(d,L){
  L=L||read(d);const C=conds(d,L),un=C.filter(c=>c.st!=='고객 확인').map(c=>c.k),S=supports(d,L),openS=S.req.filter(r=>r.open),bidOn=BIDSTAGE.includes(codeOf(d)),bd=BID.filter(b=>L.bid[b]&&L.bid[b].done).length;
  let a=null;try{a=R.actionObj(d,patchOf(d));}catch(e){}const due=a&&String(a.due||a.due_at||'').slice(0,10);
  const need=openS.length?openS.map(r=>r.cause).join(' · '):(anyF(d,'support')&&anyF(d,'support')!=='없음'?anyF(d,'support')+' (단계 정보)':'없음');
  const okN=C.length-un.length,ready=okN===C.length&&(!bidOn||bd===BID.length);
  return [['미확인',un.length?un.join(' · '):'없음',un.length?'amb':''],['필요 지원',need,''],['담당자 행동',a&&a.text?cut(a.text,34)+(due?' · '+md(due):''):'다음 행동 미등록',a&&a.text?'':'r'],['내부 지원',openS.length?openS.map(r=>r.to+'에게 '+r.cause+(r.due?' · '+md(r.due)+'까지':'')).join(' / '):'요청 없음',''],['준비 완료 조건',ready?'충족':'진행 조건 고객 확인 '+okN+' / '+C.length+(bidOn?' + 입찰 준비 '+bd+' / '+BID.length:''),ready?'ok':'']];
 }
 /* ── 그리기 ── */
 const pill=s=>'<em class="dp6-p '+(s==='고객 확인'||s==='최종 결정'?'ok':s==='담당 추정'||s==='영향'?'mid':'')+'">'+h(s)+'</em>';
 function html(d,closed){
  const S=st(d),L=read(d),C=conds(d,L),okN=C.filter(c=>c.st==='고객 확인').length,dis=closed||S.busy?' disabled':'';
  const condRows=C.map(c=>S.edit==='cond:'+c.k&&!closed?'<div class="dp6-edit"><b>'+h(c.k)+'</b><input type="text" data-dpf="cv" maxlength="60" value="'+attr(S.draft.v!=null?S.draft.v:c.v)+'" placeholder="확인한 내용 — 예: 장기수선 4.5억 반영" aria-label="'+attr(c.k)+' 내용"><div class="dp6-chips">'+CST.map(x=>'<button type="button" data-dp="cst" data-v="'+attr(x)+'" aria-pressed="'+((S.draft.st||c.st)===x)+'">'+h(x)+'</button>').join('')+'</div><div class="dp6-btns"><button type="button" data-dp="cancel">취소</button><button type="button" class="pri" data-dp="csave"'+(S.busy?' disabled':'')+'>'+(S.busy?'확인 중…':'저장')+'</button></div></div>'
   :'<button type="button" class="dp6-row" data-dp="cedit" data-v="'+attr(c.k)+'"'+(closed?' disabled':'')+' title="누르면 내용 · 확인 상태 입력"><span>'+h(c.k)+'</span>'+pill(c.st)+'<b title="'+attr(c.v)+'">'+h(c.v||'미입력')+'</b><small title="'+attr(c.src)+'">'+h(c.src)+'</small></button>').join('');
  const P=people(d),ppl=P.length?P.map(p=>'<div class="dp6-pp"><b title="'+attr(p.name)+'">'+h(p.name)+'</b><span title="'+attr(p.role)+'">'+h(p.role)+'</span>'+pill(p.infl)+'</div>').join(''):'<p class="dp6-none">등록된 관계자가 없습니다 — 왼쪽 연락처에서 등록</p>';
  const bidOn=BIDSTAGE.includes(codeOf(d)),bd=BID.filter(b=>L.bid[b]&&L.bid[b].done).length,deadline=anyF(d,'bid_deadline')||anyF(d,'decision_date')||anyF(d,'meeting_date'),submitted=/제출|완료/.test(anyF(d,'bid_plan'));
  const bid=bidOn?'<section><header><b>입찰 준비 체크</b><span>준비 '+bd+' / '+BID.length+' · '+(submitted?'제출 기록 있음':'제출 전')+(deadline?' · 마감 '+h(md(deadline)):'')+'</span></header>'+BID.map(b=>{const x=L.bid[b],done=!!(x&&x.done);return '<button type="button" class="dp6-ck'+(done?' on':'')+'" data-dp="bid" data-v="'+attr(b)+'" aria-pressed="'+done+'"'+dis+'><i>'+(done?'✓':'')+'</i><span>'+h(b)+'</span><small>'+h(done?[md(x.at),x.by].filter(Boolean).join(' · '):'')+'</small></button>';}).join('')+'<small class="dp6-note">\'준비 완료\' ≠ \'제출 완료\' · 제출은 접수증 · 제출 화면 첨부로만 완료(첨부 칸 연결 전 — 지금은 투찰 칸의 제출 기록으로만 표시)</small></section>':'';
  const SP=supports(d,L),X=S.sup;
  const supForm=X&&!closed?'<div class="dp6-edit"><div class="dp6-chips">'+CAUSE.map(c=>'<button type="button" data-dp="scause" data-v="'+attr(c[0])+'" aria-pressed="'+(X.cause===c[0])+'">'+h(c[0])+'</button>').join('')+'</div><label><span>받는 사람</span><input type="text" data-dpf="sto" list="dp6-reps" maxlength="20" value="'+attr(X.to||'')+'" placeholder="이름" aria-label="받는 사람"></label><label><span>요청</span><input type="text" data-dpf="sask" maxlength="80" value="'+attr(X.ask||'')+'" aria-label="요청 내용"></label><label><span>필요일</span><input type="date" data-dpf="sdue" min="'+today()+'" value="'+attr(X.due||'')+'" aria-label="필요일"></label><datalist id="dp6-reps">'+reps(d).map(n=>'<option value="'+attr(n)+'">').join('')+'</datalist><div class="dp6-btns"><button type="button" data-dp="cancel">취소</button><button type="button" class="pri" data-dp="ssave"'+(S.busy?' disabled':'')+'>'+(S.busy?'확인 중…':'지원 요청 보내기')+'</button></div></div>':'';
  const supList=SP.req.length?SP.req.map(r=>'<div class="dp6-sp"><b>'+h(r.cause)+'</b><span title="'+attr(r.ask)+'">'+h(r.to+' · '+r.ask)+'</span><small>'+h((r.due?'필요일 '+md(r.due)+' · ':'')+r.st)+'</small></div>').join(''):SP.memos.length?SP.memos.slice(-3).reverse().map(m=>'<div class="dp6-sp"><span title="'+attr(m.text)+'">'+h(m.text)+'</span><small>'+h(md(m.at))+'</small></div>').join(''):'<p class="dp6-none">보낸 지원 요청이 없습니다</p>';
  const H=history(d),hp=R.ListPager?R.ListPager.cut(H,S.pg||1,6):{rows:H.slice(0,6),pages:1},hist=H.length?hp.rows.map(x=>'<div class="dp6-h"><b>'+h(x.label)+'</b><span>'+h(dot(x.at)||'날짜 미기록')+(x.legacy?' (이관일)':'')+(x.who?' · '+h(x.who):'')+'</span><small title="'+attr(x.why)+'">'+h(x.legacy?'이관 자료 · 실제 진입일 미확인'+(x.why?' · '+x.why:''):x.why?'근거 · '+x.why:'근거 미기록')+'</small></div>').join('')+(R.ListPager&&hp.pages>1?R.ListPager.html(hp,{ns:'dp',v:'hist',small:true,info:false}):''):'<p class="dp6-none">단계 변경 기록이 없습니다</p>';
  const V=visit(d,L),vis=V?'<section><header><b>방문 전 요약</b><span>'+h(md(V.day)||'날짜 미정')+' · '+h(cut(V.text,24))+'</span></header><div class="dp6-kv">'+V.rows.map(r=>'<span>'+h(r[0])+'</span><b title="'+attr(r[1])+'">'+h(r[1])+'</b>').join('')+'</div>'+(V.clash.length?'<p class="dp6-clash">일정 충돌 · 같은 날 '+h(V.clash.slice(0,2).join(' · '))+(V.clash.length>2?' 외 '+(V.clash.length-2):'')+' 방문(확정) — 시각은 저장되지 않아 날짜까지만 확인</p>':'')+'</section>':'';
  const E=expected(d,L),EX=S.exp;
  const expForm=EX&&!closed?'<div class="dp6-edit"><label><span>새 예상 수주일</span><input type="date" data-dpf="eto" value="'+attr(EX.to||'')+'" aria-label="새 예상 수주일"></label><label><span>사유</span><input type="text" data-dpf="ewhy" maxlength="60" value="'+attr(EX.why||'')+'" placeholder="예: 입대의 투표 연기" aria-label="변경 사유"></label><div class="dp6-btns"><button type="button" data-dp="cancel">취소</button><button type="button" class="pri" data-dp="esave"'+(S.busy?' disabled':'')+'>'+(S.busy?'확인 중…':'저장')+'</button></div></div>':'';
  const expRows=E.list.length?E.list.slice(0,4).map(x=>'<div class="dp6-h"><b>'+h((x.from?dot(x.from)+' → ':'')+dot(x.to))+'</b><span>'+h([md(x.at),x.by].filter(Boolean).join(' · '))+'</span><small title="'+attr(x.why)+'">사유 · '+h(x.why||'미기록')+'</small></div>').join(''):'<p class="dp6-none">'+(E.cur?'변경 기록 없음 · 지금 '+h(dot(E.cur)):'예상 수주일이 등록되지 않았습니다')+'</p>';
  return '<section class="dcard dv3-made dp6" aria-label="영업 판단 · 준비 지원"><h3>영업 판단 · 준비 지원</h3>'
   +'<section><header><b>영업 진행 조건</b><span>확인 '+okN+' / '+C.length+'</span></header>'+condRows+'<small class="dp6-note">고객 확인 · 담당 추정 · 미확인 3가지로만 · 추정은 판단 근거로 쓰지 않음</small></section>'
   +'<section><header><b>의사결정자 · 관계자</b><span>연락처 ≠ 결정권자</span></header>'+ppl+'</section>'
   +bid
   +'<section><header><b>내부 지원 요청</b><span>막힌 원인별</span>'+(closed||X?'':'<button type="button" data-dp="sopen">지원 요청</button>')+'</header>'+supForm+supList+'<small class="dp6-note">처리되면 영업 담당 오늘 업무에 \'지원 회신\' · 관리자는 독촉 대신 지원을 봄</small></section>'
   +vis
   +'<section><header><b>예상 수주일 변경</b><span>'+(E.cur?'지금 '+h(dot(E.cur)):'미등록')+(E.low?' · <em class="dp6-low">'+E.delays+'회 연기 · 가능성 낮음</em>':'')+'</span>'+(closed||EX?'':'<button type="button" data-dp="eopen">'+(E.cur?'변경':'등록')+'</button>')+'</header>'+expForm+expRows+'</section>'
   +'<section><header><b>단계 변경 이력</b><span>'+H.length+'건</span></header>'+hist+'</section>'
   +(S.err?'<p class="dp6-err" role="alert">'+h(S.err)+'</p>':'')+'</section>';
 }
 const planHtml=(d,L)=>'<div class="dp6-plan dv3-made" aria-label="지금 할 일 · 구체화">'+plan(d,L).map(r=>'<div><span>'+h(r[0])+'</span><b class="'+r[2]+'" title="'+attr(r[1])+'">'+h(r[1])+'</b></div>').join('')+'</div>';
 function reps(d){try{if(R.DealOwnerV2&&R.DealOwnerV2.people)return R.DealOwnerV2.people(d)||[];}catch(e){}try{return (R.SalesScope.people()||[]).map(p=>p.name);}catch(e){return [];}}
 function mount(r,d,closed){
  if(!on()||!r||!d)return;r.querySelectorAll(':scope>.dp6').forEach(n=>n.remove());document.querySelectorAll('#detailView .dp6-plan').forEach(n=>n.remove());
  const box=document.createElement('div');box.innerHTML=html(d,!!closed);const sec=box.firstElementChild;if(!sec)return;
  const after=r.querySelector(':scope>.dvu')||r.querySelector(':scope>.dcb')||r.querySelector(':scope>.dvs-task');if(after&&after.nextSibling)r.insertBefore(sec,after.nextSibling);else r.append(sec);
  /* 지금 할 일 5줄: 보이는 '지금 할 일' 카드(.dvs-task — 없으면 예전 카드)에 붙인다. 그 카드는 이 뒤에 그려질 수 있어 그린 직후에 한 번 더 맞춘다 */
  if(!closed){const place=()=>{document.querySelectorAll('#detailView .dp6-plan').forEach(n=>n.remove());if(!on()||!r.isConnected)return;const now=r.querySelector('.dvs-task')||r.querySelector('#nowCard:not(.dv3-old)');if(!now)return;const p=document.createElement('div');p.innerHTML=planHtml(d);now.append(p.firstElementChild);};place();setTimeout(place,0);}
 }
 const repaint=()=>{try{if(R.CUR_DETAIL&&R.CUR_DETAIL.kind==='deal'&&typeof R.renderDetail==='function')R.renderDetail();}catch(e){}};
 const curDeal=()=>{const c=R.CUR_DETAIL;return c&&c.kind==='deal'&&c.item?c.item:null;};
 async function memo(d,text){const S=st(d);if(S.busy)return false;S.busy=true;S.err='';repaint();try{await R.DealDetailV3.memo(d,text,{});try{R.ActivityContext&&R.ActivityContext.clear&&R.ActivityContext.clear();}catch(e){}S.busy=false;return true;}catch(e){S.busy=false;S.err='저장하지 못했습니다: '+String(e&&e.message||e);repaint();return false;}}
 const clean=v=>String(v||'').replace(/\|/g,'/').replace(/\s+/g,' ').trim();
 async function sendSupport(d){
  const S=st(d),X=S.sup;if(!X||S.busy)return;const to=clean(X.to),ask=clean(X.ask),bad=m=>{S.err=m;repaint();};
  if(!X.cause)return bad('막힌 원인을 골라 주세요');if(!to)return bad('받는 사람을 적어 주세요');if(!ask)return bad('요청 내용을 적어 주세요');if(!/^\d{4}-\d{2}-\d{2}$/.test(X.due||'')||X.due<today())return bad('필요일을 오늘 이후로 정해 주세요');
  /* 요청 엔진이 있으면 받는 사람의 요청 목록에도 넣는다(같은 요청을 두 번 만들지 않게 한 번만) — 못 넣어도 메모는 남긴다 */
  if(X.sending)return;X.sending=true;
  let via='';if(!X.sent){try{const W=R.WorkRequest,o=R.OpsStore;if(W&&W.enabled()&&o&&o.has(W.RPC.create)){const r=await o.rpc(W.RPC.create,{target_type:'deal',target_id:String(d.id),site:d.site||d.site_name||'',brand:d.brand||'',kind:'support',label:'내부 지원 · '+X.cause,to_scope:'user',to_name:to,asks:[ask],due_at:new Date(X.due+'T18:00:00+09:00').toISOString(),due_label:md(X.due),memo:'내부 지원 요청 · '+X.cause+' — '+ask});if(r&&r.request){try{const L0=W.state().list;if(!L0.some(q=>q.id===r.request.id))L0.unshift(r.request);}catch(e){}X.sent=true;}}}catch(e){via=' (요청 목록에는 넣지 못함 — '+cut(String(e&&e.message||e),40)+' · 직접 전달 필요)';}}
  const ok=await memo(d,'[지원 요청] '+X.cause+' · '+ask+' → '+to+' · 필요일 '+md(X.due)+' — '+(meName()||'담당')+via);X.sending=false;
  if(ok){S.sup=null;if(typeof R.toast==='function')R.toast(to+'에게 '+X.cause+' 지원을 요청했습니다'+(via?' · 요청 목록에는 넣지 못해 직접 전달해 주세요':''),via?'warn':undefined);repaint();}
 }
 if(R.document){
  R.document.addEventListener('click',async e=>{
   const b=e.target.closest('#detailView .dp6 [data-dp]');if(!b||b.disabled)return;const d=curDeal();if(!d)return;e.preventDefault();e.stopPropagation();const S=st(d),a=b.dataset.dp,v=b.dataset.v;S.err='';
   if(a==='page'){S.pg=Number(b.dataset.page)||1;return repaint();}
   if(S.busy)return;
   if(a==='cancel'){S.edit='';S.draft={};S.sup=null;S.exp=null;return repaint();}
   if(a==='cedit'){S.edit='cond:'+v;S.draft={};S.sup=null;S.exp=null;return repaint();}
   if(a==='cst'){S.draft.st=v;return repaint();}
   if(a==='csave'){const k=S.edit.replace(/^cond:/,''),cur=conds(d).find(c=>c.k===k)||{},val=clean(S.draft.v!=null?S.draft.v:cur.v),stt=S.draft.st||cur.st||'미확인';if(stt!=='미확인'&&!val){S.err='확인 · 추정한 내용을 적어 주세요';return repaint();}
    if(await memo(d,'[진행 조건] '+k+' | '+stt+' | '+val)){S.edit='';S.draft={};repaint();}return;}
   if(a==='bid'){const cur=read(d).bid[v],done=!(cur&&cur.done);if(await memo(d,'[입찰 준비] '+v+' | '+(done?'완료':'해제')))repaint();return;}
   if(a==='sopen'){S.sup={cause:'',to:'',ask:'',due:'',sent:false};S.edit='';S.exp=null;return repaint();}
   if(a==='scause'){if(S.sup){const c=CAUSE.find(x=>x[0]===v);S.sup.cause=v;if(c&&(!S.sup.ask||CAUSE.some(x=>x[1]===S.sup.ask)))S.sup.ask=c[1];}return repaint();}
   if(a==='ssave')return sendSupport(d);
   if(a==='eopen'){S.exp={to:'',why:''};S.edit='';S.sup=null;return repaint();}
   if(a==='esave'){const E=expected(d),X=S.exp||{},to=String(X.to||''),why=clean(X.why);if(!/^\d{4}-\d{2}-\d{2}$/.test(to)){S.err='새 예상 수주일을 골라 주세요';return repaint();}if(to===E.cur){S.err='지금 날짜와 같습니다';return repaint();}if(E.cur&&!why){S.err='바꾸는 사유를 적어 주세요';return repaint();}
    if(await memo(d,'[예상 수주일] '+(E.cur||'')+' | '+to+' | '+(why||'최초 등록'))){S.exp=null;
     /* 최종협의 단계면 단계 정보의 예상 계약일도 같이 맞춘다(실패해도 변경 기록은 남아 있다) */
     if(codeOf(d)==='imminent'){try{await R.DealDetailV3.stageFields(d,{expected_contract:to},'예상 수주일 변경 · '+(why||'최초 등록'));}catch(x){}}
     repaint();}return;}
  },true);
  const onIn=e=>{const t=e.target;if(!t||!t.matches||!t.matches('#detailView .dp6 [data-dpf]'))return;const d=curDeal();if(!d)return;const S=st(d),k=t.dataset.dpf,v=t.value;if(k==='cv')S.draft.v=v;else if(S.sup&&k==='sto')S.sup.to=v;else if(S.sup&&k==='sask')S.sup.ask=v;else if(S.sup&&k==='sdue')S.sup.due=v;else if(S.exp&&k==='eto')S.exp.to=v;else if(S.exp&&k==='ewhy')S.exp.why=v;};
  R.document.addEventListener('input',onIn,true);R.document.addEventListener('change',onIn,true);
 }
 root.DealPrep={on,read,conds,people,history,visit,expected,supports,plan,html,mount,COND,CST,BID,CAUSE};
})(window);
