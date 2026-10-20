/* 통화 녹음 → 응대 기록 (2026-10-20 design_handoff_six_fixes ⑥) — PC 영업건 상세 · 모바일 영업건 같은 화면 · 같은 흐름
   ① 녹음 파일 고르기(영업건은 지금 연 건) → ② 글(전사) → 3줄 요약 · 고객 요청 · 약속 · 다음 행동 추림 → ③ 담당 확인 · 수정 → ④ 응대 기록 입력칸으로.
   지키는 것: 추린 것은 '제안'일 뿐 — 날짜는 '확인 필요' · 업무를 자동으로 완료하거나 새로 만들지 않는다. 저장은 기존 연락 결과 입력(결과 칩 · 다음 할 일)이 그대로 한다.
   원본 보존: [응대 기록 입력칸에 넣기]를 누르면 전사 원문을 내부 메모('[통화 전사] …')로 따로 남긴다(누를 때만).
   음성 → 글 자동 변환: 서버 함수가 아직 없다(음성 변환 API · 비용 승인 필요). 그 전에는 휴대폰 통화 앱의 '텍스트 변환' 결과를 붙여 넣는다.
   CallSummary.transcribe 가 생기면(서버 연결) 파일을 고르는 즉시 글이 채워지도록 자리만 둔다. 끄기: G.callSummaryOff */
(function(root){
 'use strict';
 const R=root,esc=v=>String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const on=()=>!(R.G&&R.G.callSummaryOff);
 const kst=()=>{try{return R.DayZoneRules?R.DayZoneRules.kst():new Date(Date.now()+9*36e5).toISOString().slice(0,10);}catch(e){return '';}};
 /* ── 추리기(규칙 · 제안) ── */
 const REQ=/(원하|원해|필요|요청|주시면|주세요|보내\s*주|알려\s*주|비교|견적|자료|금액|개략|검토)/;
 const PRO=/(까지|드리겠|드릴게|드릴께|보내\s*드|하겠습니다|할게요|약속|가겠|방문하)/;
 /* 말한 사람: '고객:' · '소장:' 등 = 고객(c) · '담당:' · '나:' = 담당(r) · 표시 없음 = 모름 — 고객 요청은 고객 말, 약속은 담당 말에서 먼저 */
 const WHO_C=/^(고객|상대|관리소장|소장|과장|대리|팀장|입주민|대표)$/,WHO_R=/^(담당|나|영업|넷폼)$/;
 function lines(t){const out=[];let who='';String(t||'').replace(/\r/g,'').split(/\n+/).forEach(ln=>{let s=ln.replace(/^\s*(\d{1,2}:\d{2}(:\d{2})?|\[[^\]]*\])\s*/,'');const m=/^\s*([가-힣A-Za-z]{1,6})\s*[:：]\s*/.exec(s);if(m){who=WHO_C.test(m[1])?'c':WHO_R.test(m[1])?'r':'';s=s.slice(m[0].length);}s.split(/(?<=[.?!。])\s+/).forEach(x=>{x=x.trim();if(x.length>=4)out.push({s:x,who});});});return out;}
 function sentences(t){return lines(t).map(x=>x.s);}
 const cut=(s,n)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s;};
 function extract(text){
  const X=lines(text),S=X.map(x=>x.s),INTRO=/(연락드렸|전화드렸|입니다\.?$|안녕하세요)/,pick=(re,pref)=>{const all=X.filter(x=>re.test(x.s)&&!INTRO.test(x.s));const mine=all.filter(x=>x.who===pref);return (mine.length?mine:all.filter(x=>x.who==='').length?all.filter(x=>x.who===''):all).map(x=>x.s);};/* 말한 사람이 표시돼 있으면 그 사람 말만 */
  const req=pick(REQ,'c'),pro=pick(PRO,'r');
  let next=null;
  try{const IM=R.InquiryMemo;if(IM&&IM.parse){const P=(IM.parse(String(text||''),new Date().toISOString()).promises||[]).filter(p=>p&&(p.title||p.text));if(P.length){const p=P[0];next={text:cut(p.title||p.text,60),due:p.due?String(p.due).slice(0,10):''};}}}catch(e){}
  if(!next&&pro.length)next={text:cut(pro[0],60),due:''};
  const request=req.length?cut(req.slice(0,2).join(' · '),90):'',promise=pro.length?cut(pro[0],70):'';
  const used=new Set([req[0],pro[0]].filter(Boolean)),other=X.filter(x=>x.who!=='r'&&!used.has(x.s)&&!INTRO.test(x.s)).map(x=>x.s)[0]||'';
  const third=next&&next.text!==cut(promise,60)?'다음: '+next.text+(next.due?' · '+next.due.slice(5).replace('-','.')+'(날짜 확인 필요)':''):other?'참고: '+cut(other,60):'';
  const summary=[request?'고객 요청: '+cut(req[0],60):S[0]?cut(S[0],60):'',promise?'약속: '+cut(promise,60):'',third].filter(Boolean).slice(0,3);
  return {summary,request,promise,next,count:S.length};
 }
 /* ── 화면(어디서 열든 같은 것) ── */
 let M=null;/* {deal, onApply, onTranscriptSave, file, text, ex, err} */
 function html(){
  const x=M.ex,n=x&&x.next;
  return '<div class="cs-ovl" role="dialog" aria-label="통화 녹음 → 응대 기록"><div class="cs-box">'
   +'<header><b>통화 녹음 → 응대 기록</b><span>'+esc(M.site||'')+'</span><button type="button" class="cs-x" data-cs="close" aria-label="닫기">✕</button></header>'
   +'<ol class="cs-steps"><li class="'+(M.file||M.text?'done':'on')+'">녹음 파일</li><li class="'+(x?'done':M.text?'on':'')+'">글 · 요약</li><li class="'+(x?'on':'')+'">확인 · 수정</li><li>응대 기록</li></ol>'
   +'<label class="cs-file"><span>녹음 파일</span><input type="file" accept="audio/*" data-cs="file"><small>'+esc(M.file?M.file+' · ':'')+'음성 → 글 자동 변환은 서버 연결 후 사용 · 지금은 통화 앱의 텍스트 변환 결과를 아래에 붙여 넣기</small></label>'
   +'<label class="cs-tr"><span>통화 내용(글)</span><textarea data-cs="text" rows="6" placeholder="통화 앱에서 변환한 글을 붙여 넣으세요">'+esc(M.text||'')+'</textarea></label>'
   +'<div class="cs-act"><button type="button" class="cs-p" data-cs="sum"'+(String(M.text||'').trim()?'':' disabled')+'>요약하기</button></div>'
   +(x?'<section class="cs-sum"><b>자동으로 추린 것 · 확인 전 <em>제안</em></b>'
    +'<label><span>3줄 요약</span><textarea data-cs-f="summary" rows="3">'+esc(x.summary.join('\n'))+'</textarea></label>'
    +'<label><span>고객 요청</span><input data-cs-f="request" value="'+esc(x.request)+'" placeholder="없음"></label>'
    +'<label><span>약속</span><input data-cs-f="promise" value="'+esc(x.promise)+'" placeholder="없음"></label>'
    +'<label><span>다음 행동</span><input data-cs-f="next" value="'+esc(n?n.text:'')+'" placeholder="없음"><input type="date" data-cs-f="due" value="'+esc(n&&n.due||'')+'"><small class="cs-chk">날짜 확인 필요</small></label>'
    +'<p class="cs-note">업무를 자동으로 완료하지 않습니다 · [응대 기록 입력칸에 넣기] 뒤 결과를 고르고 저장해야 기록됩니다 · 전사 원문은 내부 메모로 따로 남습니다</p>'
    +'<div class="cs-act"><button type="button" class="cs-g" data-cs="close">닫기</button><button type="button" class="cs-p" data-cs="apply">응대 기록 입력칸에 넣기</button></div></section>':'')
   +(M.err?'<p class="cs-err">'+esc(M.err)+'</p>':'')+'</div></div>';
 }
 function draw(){let el=document.getElementById('cs-root');if(!M){if(el)el.remove();return;}if(!el){el=document.createElement('div');el.id='cs-root';document.body.append(el);}
  const act=document.activeElement,f=act&&el.contains(act)?act.getAttribute('data-cs')||act.getAttribute('data-cs-f'):'';el.innerHTML=html();if(f){const n=el.querySelector('[data-cs="'+f+'"],[data-cs-f="'+f+'"]');if(n){n.focus();try{n.setSelectionRange(n.value.length,n.value.length);}catch(e){}}}}
 function open(o){if(!on())return false;M={deal:o.deal,site:o.site||(o.deal&&(o.deal.site||o.deal.nm))||'',onApply:o.onApply,onTranscriptSave:o.onTranscriptSave,file:'',text:'',ex:null,err:''};draw();return true;}
 function close(){M=null;draw();}
 /* 응대 기록 입력칸에 넣을 글: 3줄 요약 + 요청 · 약속 · 다음(날짜 확인 필요) — 사람이 고친 값 그대로 */
 function noteOf(F){const lines=String(F.summary||'').split('\n').map(s=>s.trim()).filter(Boolean);const extra=[F.request&&!lines.some(l=>l.includes(F.request))?'고객 요청: '+F.request:'',F.promise&&!lines.some(l=>l.includes(F.promise))?'약속: '+F.promise:''].filter(Boolean);return ['[통화 녹음 요약]'].concat(lines,extra).join('\n');}
 async function apply(){
  const box=document.getElementById('cs-root');if(!M||!box)return;const F={};box.querySelectorAll('[data-cs-f]').forEach(n=>{F[n.getAttribute('data-cs-f')]=n.value;});
  const note=noteOf(F),next=F.next?{text:F.next.trim(),due:F.due||''}:null,deal=M.deal,text=String(M.text||'').trim(),saveTr=M.onTranscriptSave,go=M.onApply,file=M.file;
  close();
  try{if(go)go(note,next);}catch(e){}
  if(text&&saveTr){try{await saveTr(deal,'[통화 전사'+(file?' · '+file:'')+'] '+text.slice(0,4000));}catch(e){try{R.toast&&R.toast('전사 원문을 내부 메모로 남기지 못했습니다 · 응대 기록 입력은 그대로','warn');}catch(x){}}}
 }
 if(typeof document!=='undefined'){
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#cs-root [data-cs]');if(!b||!M)return;const a=b.getAttribute('data-cs');
   if(a==='close'){e.preventDefault();return close();}
   if(a==='sum'){e.preventDefault();M.ex=extract(M.text);M.err=M.ex.count?'':'요약할 문장을 찾지 못했습니다 · 통화 내용을 확인해 주세요';return draw();}
   if(a==='apply'){e.preventDefault();return apply();}},true);
  document.addEventListener('input',e=>{const t=e.target;if(!M||!t.closest||!t.closest('#cs-root'))return;if(t.getAttribute('data-cs')==='text'){M.text=t.value;const b=document.querySelector('#cs-root [data-cs="sum"]');if(b)b.disabled=!t.value.trim();}},true);
  document.addEventListener('change',e=>{const t=e.target;if(!M||!t.closest||!t.closest('#cs-root')||t.getAttribute('data-cs')!=='file')return;const f=t.files&&t.files[0];M.file=f?f.name:'';
   if(f&&typeof R.CallSummary.transcribe==='function'){M.err='';draw();Promise.resolve(R.CallSummary.transcribe(f,M.deal)).then(txt=>{if(M&&txt){M.text=String(txt);M.ex=extract(M.text);draw();}}).catch(x=>{if(M){M.err='글로 바꾸지 못했습니다: '+String(x&&x.message||x);draw();}});}else draw();},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&M){e.stopPropagation();close();}},true);
 }
 /* ── PC 영업건 상세: 연락 결과 입력칸 머리에 [통화 녹음] 단추 ── */
 function decoratePC(){
  if(!on())return;const box=document.querySelector('#detailView #ddvComposer');if(!box||box.querySelector('.cs-open'))return;const d=R.CUR_DETAIL&&R.CUR_DETAIL.kind==='deal'?R.CUR_DETAIL.item:null;if(!d)return;
  const tabs=box.querySelector('[role=tablist]')||box.firstElementChild;if(!tabs)return;
  const b=document.createElement('button');b.type='button';b.className='cs-open';b.textContent='통화 녹음 요약';b.title='녹음 파일 · 통화 글 → 요약 → 확인 뒤 이 입력칸으로';
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const x=R.CUR_DETAIL&&R.CUR_DETAIL.item;if(!x)return;open({deal:x,site:x.site||x.site_name,
   onApply:note=>{const v=document.querySelector('#detailView #ddvComposer');if(!v)return;const tab=v.querySelector('[role=tab][data-type="전화"]');if(tab&&tab.getAttribute('aria-selected')!=='true')tab.click();setTimeout(()=>{const ta=document.querySelector('#detailView #ddvComposer textarea');if(ta){ta.value=(ta.value.trim()?ta.value.trim()+'\n':'')+note;ta.dispatchEvent(new Event('input',{bubbles:true}));try{ta.focus();}catch(x){}}try{R.toast&&R.toast('요약을 응대 기록 입력칸에 넣었습니다 · 결과를 고르고 저장하세요');}catch(x){}},120);},
   onTranscriptSave:(deal,memo)=>R.DealDetailV3&&R.DealDetailV3.memo?R.DealDetailV3.memo(deal,memo,{}):null});});
  tabs.append(b);
 }
 /* ── 모바일 연락 결과 입력(D): 상담 내용 칸 아래 같은 단추 · 같은 창 — 넣는 곳만 모바일 칸(300자) ── */
 function decorateMobile(){
  if(!on())return;const ta0=document.querySelector('textarea[data-ce-in="memo"]');if(!ta0||document.querySelector('.cs-open.cs-m'))return;const say=ta0.closest('.ce-say')||ta0.parentNode;if(!say||ta0.closest('[hidden]'))return;/* 부재 · 번호 오류 = 상담 칸이 숨겨지면 요약 버튼도 없음 */
  const deal=()=>{try{return (R.DEALS||[]).find(d=>String(d.id)===String(R.G&&R.G.deal))||null;}catch(e){return null;}};
  const b=document.createElement('button');b.type='button';b.className='cs-open cs-m';b.textContent='통화 녹음 요약';
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const d=deal();if(!d)return;open({deal:d,site:d.nm,
   onApply:note=>{const ta=document.querySelector('textarea[data-ce-in="memo"]');if(!ta)return;const v=((ta.value.trim()?ta.value.trim()+'\n':'')+note.replace(/^\[통화 녹음 요약\]\n/,'')).slice(0,Number(ta.maxLength)>0?Number(ta.maxLength):300);ta.value=v;ta.dispatchEvent(new Event('input',{bubbles:true}));try{R.toast&&R.toast('요약을 상담 내용에 넣었습니다 · 결과를 고르고 저장하세요');}catch(x){}},
   onTranscriptSave:(x,memo)=>{if(typeof R.queueMobileContactOperation!=='function')return null;return R.queueMobileContactOperation('activity',{opportunity_id:String(x.id),intent:'standalone',type:'메모',note:memo,occurred_at:new Date().toISOString(),meaningful_contact:false});}});});
  say.after(b);
 }
 if(typeof MutationObserver!=='undefined'&&typeof document!=='undefined'){const mo=new MutationObserver(()=>{try{decoratePC();}catch(e){}try{decorateMobile();}catch(e){}});const start=()=>{const v=document.getElementById('detailView')||document.body;mo.observe(v,{childList:true,subtree:true});};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();}
 R.CallSummary={on,extract,open,close,noteOf,decoratePC,decorateMobile,transcribe:null,state:()=>M};
})(typeof window==='object'?window:globalThis);
