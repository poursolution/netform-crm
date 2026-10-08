/* 견적문의 · 과거 메모의 통화 · 약속을 지금 업무로 (2026-10-08 대표 핸드오프 design_handoff_inquiry_memo · 시안 '견적문의 과거 약속 확인 시안')
   견적문의 v4 배치 그대로. 여기서 하는 것:
    ① 날짜 3개 분리 — 접수일(구글시트 · 바뀌지 않음) / 실제 연결일(통화 연결 · 회신 · 미팅 기록에서만) / 메모 속 통화(이관 메모에서 찾은 후보).
       실제 연결일이 접수일을 그대로 복사한 값(기록 없이 시각만 같은 날)이면 '확인 필요'. 메모 원문은 통화 기록 후보 = 노랑 · 약속 후보 = 파랑으로 표시한다.
       [n.n 통화로 실제 연결일 보완]은 담당이 정해진 문의에서만, 담당 · 관리자만 누른다. 원래 값은 지우지 않고(서버 이력 · 응대 이력) 보완한 날짜만 따로 둔다 — 첫 연락 판정(InquiryFlow)은 그대로.
       AI(규칙)는 후보만 찾고 확정은 담당이 한다.
    ② 과거 약속 확인함 — 메모에서 사진 회신 · 방문 · 견적 전달 · 재연락 · 회의 약속을 찾아 약속마다 [완료 / 미완료 / 확인 불가]를 받는다.
       완료 = 기록만 · 미완료 = 지금 할 일로 등록('… 다시 확인') · 확인 불가 = '첫 통화에서 물어볼 것'. 판단 없이 과거 약속을 새 업무로 만들지 않는다.
    ③ 날짜 계산 = 한국(Asia/Seoul) 날짜 기준 일수(오늘 날짜 − 기준 날짜). 접속 PC 의 시간대에 기대지 않는다.
   저장: 서버 함수 crm_inquiry_memo_review_v1 · 읽기 crm_inquiry_memo_review_list_v1(sql/inquiry-memo-review-v1-20261008.sql). 설치 전에는 이 PC 의 기록(문의 patch.memoReview)으로 같은 판정을 하고,
         보낼 기록은 localStorage(crm.inqMemo.outbox.v1)에 모아 두었다가 설치 뒤 보낸다(견적문의 흐름과 같은 방식).
   끄기: G.inqMemoOff=true → 날짜 · 메모 · 약속 칸과 첫마디 문장이 사라지고, 경과일 계산만 한국 날짜 기준으로 남는다. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.InquiryMemo=api;})(typeof window==='undefined'?globalThis:window,function(root){
 'use strict';
 const TZ='Asia/Seoul',DAY=864e5,RPC='crm_inquiry_memo_review_v1',LIST='crm_inquiry_memo_review_list_v1',OUT_KEY='crm.inqMemo.outbox.v1',MARK='[과거 약속]';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const on=()=>!(root.G&&root.G.inqMemoOff);
 /* ── 한국 날짜 ── */
 const fmtDay=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'});
 const fmtHm=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false});
 const ms=t=>t instanceof Date?t.getTime():typeof t==='number'?t:Date.parse(t);
 const day=t=>{const n=ms(t);return Number.isFinite(n)?fmtDay.format(new Date(n)):'';};
 const dayNo=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||''));return m?Math.round(Date.UTC(+m[1],+m[2]-1,+m[3])/DAY):NaN;};
 /* 기준 날짜 → 오늘(또는 to)까지 한국 날짜 일수 */
 const diff=(from,to)=>dayNo(day(to==null?Date.now():to))-dayNo(day(from));
 /* 경과 일수: 하루(24시간)가 안 되면 0, 넘으면 한국 날짜가 며칠 바뀌었는지(자정 기준) */
 const days=(from,to)=>{const a=ms(from),b=to==null?Date.now():ms(to);if(!Number.isFinite(a)||!Number.isFinite(b))return null;return b-a<DAY?0:Math.max(1,diff(a,b));};
 const md=t=>{const s=day(t);return s?(+s.slice(5,7))+'.'+(+s.slice(8,10)):'';};
 const ymd=t=>{const s=day(t);return s?(+s.slice(0,4))+'.'+(+s.slice(5,7))+'.'+(+s.slice(8,10)):'';};
 const hm=t=>{const n=ms(t);return Number.isFinite(n)?fmtHm.format(new Date(n)):'';};
 const addDays=(s,n)=>{const d=dayNo(s);return Number.isFinite(d)?new Date((d+n)*DAY).toISOString().slice(0,10):'';};
 const today=()=>day(Date.now());
 /* 1일 미만은 분 · 시간, 그 위는 한국 날짜 일수(자정을 넘기면 1일) */
 function span(from,to){
  const a=ms(from),b=to==null?Date.now():ms(to);if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)return '—';
  const hr=(b-a)/36e5;if(hr<1)return Math.max(1,Math.round(hr*60))+'분';if(hr<24)return Math.floor(hr)+'시간';
  return Math.max(1,diff(a,b))+'일';
 }
 const esc=v=>{const s=String(v==null?'':v);return root.esc?root.esc(s):s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));};
 const attr=v=>root.escAttr?root.escAttr(String(v==null?'':v)):esc(v).replace(/`/g,'&#96;');
 /* ── 메모에서 통화 · 약속 찾기(규칙 — 후보만, 확정은 담당) ── */
 const NOT_CALL=/부재|안\s*받|받지\s*않|통화\s*불가|연결\s*(안|불가|되지)|통화\s*(안|못)\s*(됨|되|함|했|돼)|통화\s*(예정|필요|요망|하기로|할\s*것|해야|시도)|연락\s*(두절|안\s*됨|불가)|무응답/;
 const CALL_RE=/(?:통화\s*(?:완료|함|했|하였|됨|되었|성공|연결|내용)|(?:전화|연락)\s*(?:통화\s*)?(?:했|함|하였|됨|완료|받았)|(?:관리소장|소장|담당자|고객|대표|위원장|총무|입주자\s*대표|회장|과장|팀장|부장)\s*(?:님)?\s*(?:와|과|이랑|하고)?\s*통화|상담\s*(?:완료|함|했)|통화\s*후|통화로|전화\s*상담)(?:\s*(?:완료|함|했\S*|하였\S*|됨|성공))?/;
 const DATE_IN=[/(\d{4})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})/,/(?<!\d)(\d{1,2})\s*월\s*(\d{1,2})\s*일/,/(?<![\d.])(\d{1,2})\s*[.\/]\s*(\d{1,2})(?![\d.])/];
 const COMMIT='(?:가능|예정|하기로|약속|하겠|드리겠|오기로|올\\s*것|할\\s*것|해\\s*주기로|주기로|드리기로|준다고|주신다|보내준다|보내주신다|보내기로|받기로)';
 const OBJ='(사진|도면|자료|서류|현황|평면도|견적\\s*요청서)';
 const PROMISE=[
  ['material',new RegExp(OBJ+'[^.,;\\n]{0,14}?(?:(이메일|메일|카톡|카카오톡|카카오|문자|팩스)[^.,;\\n]{0,8}?)?(받기로|보내기로|보내\\s*주기로|주기로|드리기로|준다고|주신다|보내준다|보내주신다|제공\\s*하기로|전달\\s*하기로)(?:\\s*함|\\s*하다고\\s*함)?')],
  ['visit',new RegExp('((?:다음\\s*날|이튿날|내일|모레|\\d{1,2}\\s*[./]\\s*\\d{1,2}|\\d{1,2}월\\s*\\d{1,2}일)\\s*)?(?:현장\\s*)?(방문|내방|실측)[^.,;\\n]{0,8}?'+COMMIT+'[^.,;\\n]{0,8}')],
  ['quote',/견적(?:서)?[^.,;\n]{0,8}?(?:보내|발송|전달|송부|드리|제출)(?:\s*드리)?(?:기로|겠|예정|하기로|할\s*것|해\s*주기로|해\s*준다고|준다고|주신다|가능)[^.,;\n]{0,6}/],
  ['recall',/(?:(?:다시|재)\s*(?:연락|전화|통화)[^.,;\n]{0,8}?(?:주기로|드리기로|하기로|예정|하겠|드리겠)|(?:연락|전화)\s*(?:주기로|드리기로|준다고|주신다고|오기로)|(\d+\s*일|이틀|사흘|일주일|내일|모레|다음\s*주)\s*(?:후|뒤)\s*(?:에\s*)?(?:연락|통화|전화)[^.,;\n]{0,6})(?:\s*함|\s*하다고\s*함)?/],
  ['meeting',/(?:대표\s*회의|입대의|입주자\s*대표\s*회의|이사회|총회|회의)[^.,;\n]{0,10}?(?:예정|상정|개최|안건|\d{1,2}\s*[./]\s*\d{1,2}|\d{1,2}월\s*\d{1,2}일)[^.,;\n]{0,8}/]
 ];
 const ro=w=>{const c=String(w).charCodeAt(String(w).length-1)-0xAC00;if(c<0||c>11171)return '로';const j=c%28;return j===0||j===8?'로':'으로';};
 const VIA={이메일:'이메일',메일:'이메일',카톡:'카카오톡',카카오톡:'카카오톡',카카오:'카카오톡',문자:'문자',팩스:'팩스'};
 /* 약속 한 줄의 이름 · 첫마디용 말 */
 function nameOf(type,m,when){
  if(type==='material'){const obj=String(m[1]||'').replace(/\s+/g,' '),via=VIA[m[2]]||'',give=/보내|주기로|드리기로|제공|전달|준다|주신다/.test(m[3]);const t=[obj,via?via+ro(via):'',give?'보내기':'받기'].filter(Boolean).join(' ');return {title:t,say:[obj,via?via+ro(via):'',give?'보내드리기로':'받기로'].filter(Boolean).join(' ')};}
  if(type==='visit'){const pre=String(m[1]||'').trim(),w=/다음\s*날|이튿날/.test(pre)?'다음 날 ':/내일/.test(pre)?'내일 ':/모레/.test(pre)?'모레 ':when?md(when)+' ':'',kind=m[2]==='실측'?'실측':'방문';return {title:w+'현장 '+kind,say:w+'현장 '+kind+'하기로'};}
  if(type==='quote')return {title:'견적 보내기',say:'견적을 보내드리기로'};
  if(type==='recall')return {title:'다시 연락하기',say:'다시 연락드리기로'};
  return {title:'회의 일정 확인',say:'회의 일정을 확인하기로'};
 }
 const hash=s=>{let h=5381;const t=String(s).replace(/\s+/g,'');for(let i=0;i<t.length;i++)h=((h<<5)+h+t.charCodeAt(i))>>>0;return h.toString(36);};
 /* 문장 나누기: 날짜의 점(9.30)은 끊지 않는다. 오프셋을 그대로 둬 원문에 표시를 겹칠 수 있게 한다 */
 function sentences(text){
  const out=[],safe=String(text).replace(/(\d)\.(\d)/g,'$1․$2'),rr=/[^.\n;!?]+[.\n;!?]*/g;let m;
  while((m=rr.exec(safe))){const t=m[0];if(t.trim())out.push({text:String(text).slice(m.index,m.index+t.length),start:m.index});}
  return out;
 }
 /* 문장에 적힌 날짜(없으면 ''): 기준일 이후로 멀리 가면 전년으로 본다 */
 function dateIn(s,base){
  let m=DATE_IN[0].exec(s);if(m)return pad(+m[1],+m[2],+m[3]);
  const by=+String(base||today()).slice(0,4)||new Date().getFullYear();
  m=DATE_IN[1].exec(s)||DATE_IN[2].exec(s);if(!m)return '';
  const mo=+m[1],dd=+m[2];if(mo<1||mo>12||dd<1||dd>31)return '';
  let y=by,d=pad(y,mo,dd);if(base&&dayNo(d)-dayNo(base)>60)d=pad(y-1,mo,dd);return d;
 };
 const pad=(y,m,d)=>y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
 /* 메모 한 덩어리(기준 날짜 base = 메모에 찍힌 날, 없으면 '') → 통화 · 약속 후보 + 표시 구간 */
 function parse(text,base){
  const calls=[],promises=[],ranges=[],seen=new Set();
  sentences(text).forEach(sn=>{
   const t=sn.text;
   const cm=CALL_RE.exec(t);
   if(cm&&!NOT_CALL.test(t)){
    const d=dateIn(t,base)||base||'',key='c-'+hash(t);
    if(!seen.has(key)){seen.add(key);calls.push({key,date:d,sentence:t.trim(),phrase:cm[0]});ranges.push({s:sn.start+cm.index,e:sn.start+cm.index+cm[0].length,k:'call'});}
   }
   PROMISE.forEach(([type,re])=>{
    const m=re.exec(t);if(!m)return;
    const when=dateIn(t,base),nm=nameOf(type,m,when),key='p-'+type+'-'+hash(t);
    if(seen.has(key))return;seen.add(key);
    promises.push({key,type,title:nm.title,say:nm.say,date:base||when||'',sentence:t.trim(),phrase:m[0],when});
    ranges.push({s:sn.start+m.index,e:sn.start+m.index+m[0].length,k:'pro'});
   });
  });
  ranges.sort((a,b)=>a.s-b.s||b.e-a.e);const keep=[];ranges.forEach(r=>{const last=keep[keep.length-1];if(!last||r.s>=last.e)keep.push(r);});
  return {calls,promises,ranges:keep};
 }
 /* 원문 + 표시: 통화 기록 후보 = 노랑(im-call) · 약속 후보 = 파랑(im-pro) */
 function marked(text,ranges){
  const s=String(text);let out='',p=0;
  (ranges||[]).forEach(r=>{out+=esc(s.slice(p,r.s))+'<mark class="im-'+(r.k==='call'?'call':'pro')+'">'+esc(s.slice(r.s,r.e))+'</mark>';p=r.e;});
  return out+esc(s.slice(p));
 }
 /* ── 문의에서 이관 메모 읽기(응대 이력의 externalResponses 와 같은 근거 · 읽기 전용) ── */
 const rawOf=q=>q&&q.raw&&typeof q.raw==='object'?q.raw:{};
 function memosOf(q){
  const raw=rawOf(q),history=Array.isArray(raw.external_change_history)?raw.external_change_history:[],out=[];
  let rest=String(raw['응대내용']||'').trim();
  history.forEach(e=>{
   if(!e||e.kind!=='response'||!e.after)return;const text=String(e.after.response_content||'').trim(),at=String(e.source_at||'');if(!text)return;
   const n=Date.parse(at),stamp=Number.isFinite(n)?new Date(n+9*36e5).toISOString().slice(0,19).replace('T',' '):'',copy=(stamp?'['+stamp+'] ':'')+text;
   if(rest.includes(copy))rest=rest.replace(copy,'').trim();
   out.push({at:Number.isFinite(n)?day(n):'',text,src:'이관 메모'});
  });
  if(rest){
   const parts=rest.split(/(?=\[\d{4}-\d{2}-\d{2}[ T][\d:]{4,8}\])/);
   parts.forEach(p=>{const m=/^\[(\d{4}-\d{2}-\d{2})[ T][\d:]{4,8}\]\s*([\s\S]*)$/.exec(p.trim());if(m){if(m[2].trim())out.push({at:m[1],text:m[2].trim(),src:'이관 메모'});}else if(p.trim())out.push({at:'',text:p.trim(),src:'이관 메모 · 시각 미기록'});});
  }
  return out.sort((a,b)=>String(a.at||'~').localeCompare(String(b.at||'~')));
 }
 /* ── 저장된 판단(서버 + 이 PC) ── */
 /* 쓰기용(없으면 만든다) · 읽기용(만들지 않는다 — 목록을 그릴 때 모든 문의에 빈 patch 가 생기지 않게) */
 const patchFor=q=>{try{if(typeof root.detailPatchFor==='function')return root.detailPatchFor('inq',root.inqKey(q));}catch(e){}try{return root.itemPatch(q,'inq')||{};}catch(e){return {};}};
 const readPatch=q=>{try{return root.itemPatch(q,'inq')||{};}catch(e){return {};}};
 const SRV=new Map();let SV=0,loadAt=0,loadBusy=false;
 const store=()=>root.OpsStore;
 const can=name=>{try{return !!store()&&store().has(name);}catch(e){return false;}};
 const later=(a,b)=>!a?b:!b?a:(Date.parse(a.at||'')>=Date.parse(b.at||'')?a:b);
 function review(q){
  const id=String(q&&q.id||''),p=readPatch(q).memoReview||{},s=SRV.get(id)||{};
  const promises=Object.assign({},s.promises||{});
  Object.keys(p.promises||{}).forEach(k=>{promises[k]=later(promises[k],p.promises[k]);});
  return {call:later(s.call||null,p.call||null),promises};
 }
 /* ── 한 문의의 메모 읽기 결과(캐시) ── */
 const memo=new WeakMap();
 function scan(q){
  if(!q||typeof q!=='object')return {memos:[],calls:[],promises:[]};
  const raw=rawOf(q),sig=[String(raw['응대내용']||'').length,(raw.external_change_history||[]).length,SV,JSON.stringify(readPatch(q).memoReview||{}).length].join('|'),c=memo.get(q);
  if(c&&c.sig===sig)return c.v;
  const memos=memosOf(q).map(m=>{const r=parse(m.text,m.at);return Object.assign({},m,{calls:r.calls,promises:r.promises,html:marked(m.text,r.ranges)});});
  const calls=[],promises=[];memos.forEach(m=>{m.calls.forEach(x=>calls.push(Object.assign({memoAt:m.at},x)));m.promises.forEach(x=>promises.push(Object.assign({memoAt:m.at},x)));});
  const v={memos,calls,promises};memo.set(q,{sig,v});return v;
 }
 /* 약속 + 판단(res = 완료 | 미완료 | 확인 불가 | '') */
 function promises(q){const r=review(q).promises;return scan(q).promises.map(p=>Object.assign({},p,{res:(r[p.key]&&r[p.key].res)||'',decided:r[p.key]||null}));}
 const pending=q=>on()?promises(q).filter(p=>!p.res):[];
 const asks=q=>promises(q).filter(p=>p.res==='확인 불가');
 const flow=()=>root.InquiryFlow&&root.InquiryFlow.on&&root.InquiryFlow.on()?root.InquiryFlow:null;
 const createdOf=q=>{try{return root.inquiryCreatedAt(q)||'';}catch(e){return '';}};
 /* ── 날짜 3개: 접수일 · 실제 연결일 · 메모 속 통화 ── */
 function connection(q){
  const F=flow(),recv=createdOf(q),rv=review(q).call;let fc='';try{fc=F?F.firstConnectedAt(q):'';}catch(e){}
  if(!fc)fc=String(q.first_response_at||q.responded_at||q.respondedAt||'');
  if(rv)return {state:'supplemented',day:rv.on_date,orig:fc,recv,by:rv.by||'',at:rv.at||''};
  if(!fc)return {state:'none',day:'',orig:'',recv};
  let genuine=false;try{const L=F?F.state(q).logs:[];genuine=L.some(l=>l.kind==='connected'&&Math.abs(ms(l.at)-ms(fc))<5000);}catch(e){}
  const copy=!genuine&&(Math.abs(ms(fc)-ms(recv))<60000||(!!day(fc)&&day(fc)===day(recv)));
  return {state:copy?'copy':'ok',day:day(fc),orig:fc,recv};
 }
 function dates(q){
  const c=connection(q),sc=scan(q),first=sc.calls.filter(x=>x.date).sort((a,b)=>a.date.localeCompare(b.date))[0]||null;
  return {recv:createdOf(q),conn:c,memoCall:first,calls:sc.calls};
 }
 /* 목록 · 첫마디가 쓰는 한 줄 */
 const pendingN=q=>pending(q).length;
 const copied=q=>{try{return on()&&connection(q).state==='copy';}catch(e){return false;}};
 const memoCallDay=q=>{try{const d=dates(q).memoCall;return d?d.date:'';}catch(e){return '';}};
 const hasMemo=q=>{try{return scan(q).memos.length>0;}catch(e){return false;}};
 function opener(q,who){
  const rest=promises(q).filter(p=>p.res!=='완료');if(!on()||!rest.length)return '';
  const first=rest.map(p=>p.date||p.when).filter(Boolean).sort()[0]||'',when=first?(+first.slice(5,7))+'월에 ':'예전에 ';
  return '"안녕하세요, 넷폼 '+who+'입니다. '+when+rest.map(p=>p.say).join(', ')+' 했었는데, 그 뒤 진행 상황 여쭤보려고 연락드렸습니다."';
 }
 /* ── 권한: 담당이 정해진 문의에서 담당 본인 또는 관리자 ── */
 const isAdmin=()=>{try{return !!root.inqCtlIsAdmin();}catch(e){return false;}};
 function canEdit(q){
  try{if(!root.inquiryAssigned(q))return false;if(isAdmin())return true;const me=root.repN(root.ME&&root.ME.name),ow=root.repN(root.inquiryRoutedOwner(q));return !!me&&me===ow;}catch(e){return false;}
 }
 const uuid=()=>{try{return root.crypto.randomUUID();}catch(e){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16);});}};
 const meName=()=>{try{const n=root.repN(root.ME&&root.ME.name);return n&&n!=='미배정'?n:'';}catch(e){return '';}};
 /* ── 서버 보내기(모아 두었다 차례로) ── */
 let OUT=null,flushing=false;
 const outbox=()=>{if(OUT)return OUT;try{OUT=JSON.parse(root.localStorage.getItem(OUT_KEY)||'[]');if(!Array.isArray(OUT))OUT=[];}catch(e){OUT=[];}return OUT;};
 const keepOut=()=>{try{root.localStorage.setItem(OUT_KEY,JSON.stringify(outbox().slice(-200)));}catch(e){}};
 function takeServer(rows){
  const next=new Map();
  (rows||[]).forEach(r=>{if(!r||!r.inquiry_id)return;const id=String(r.inquiry_id),o=next.get(id)||{call:null,promises:{}},v={res:r.result||'',on_date:r.on_date||'',title:r.title||'',src:r.source_text||'',at:r.decided_at||'',by:r.decided_by||'',orig:r.original_at||''};
   if(r.kind==='call')o.call=v;else o.promises[r.item_key]=v;next.set(id,o);});
  const sig=m=>JSON.stringify([...m.entries()]);if(sig(next)!==sig(SRV)){SRV.clear();next.forEach((v,k)=>SRV.set(k,v));SV++;return true;}return false;
 }
 function load(force){
  if(!on()||loadBusy||!can(LIST))return Promise.resolve(false);if(!force&&loadAt&&Date.now()-loadAt<120000)return Promise.resolve(false);
  loadBusy=true;
  return store().rpc(LIST,{}).then(r=>{loadAt=Date.now();if(takeServer(r.reviews)){try{root.paint&&root.paint();}catch(e){}}return true;}).catch(()=>{loadAt=Date.now();return false;}).finally(()=>{loadBusy=false;});
 }
 async function flush(){
  if(flushing||!on()||!root.ME||!can(RPC)||!outbox().length)return;flushing=true;let changed=false;
  try{while(outbox().length){const item=outbox()[0];
    if(Date.now()-Number(item.queued_at||0)>14*DAY){outbox().shift();keepOut();continue;}
    const body=Object.assign({},item);delete body.queued_at;
    try{await store().rpc(RPC,body);changed=true;outbox().shift();keepOut();}
    catch(e){if(e&&e.unavailable)break;if(/forbidden|invalid payload|담당자 또는 관리자만|찾을 수 없습니다|기술자문/.test(String(e&&e.message||''))){outbox().shift();keepOut();continue;}break;}}
  }finally{flushing=false;if(changed){loadAt=0;load(true);}}
 }
 const queue=body=>{outbox().push(Object.assign({queued_at:Date.now()},body));keepOut();flush();};
 function warm(){if(!on()||!root.ME)return;if(!loadAt||Date.now()-loadAt>120000)load();flush();}
 /* ── 저장 명령 ── */
 const save=()=>{try{root.saveLocal&&root.saveLocal();}catch(e){}};
 function note(q,text,at){
  /* 응대 이력에 한 줄(고객 접점 · 마지막 연락 시각이 아니다 — lastActivity 를 건드리지 않는다) */
  const p=patchFor(q);p.activities=p.activities||[];p.activities.push({id:'im-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),type:'기타',note:text,result:'',at,actor:meName()||root.repN(q.assignee)});
 }
 /* 메모 속 통화로 실제 연결일 보완 */
 function callSupplement(q,o){
  if(!canEdit(q))throw Error(root.inquiryAssigned(q)?'담당 또는 관리자만 보완할 수 있습니다.':'담당이 정해진 뒤에 보완할 수 있습니다.');
  const it=scan(q).calls.find(c=>c.key===o.key);if(!it||!it.date)throw Error('보완할 통화 날짜를 찾지 못했습니다.');
  const cur=connection(q);if(cur.state==='ok')throw Error('이미 확인된 실제 연결일이 있습니다.');
  const created=day(createdOf(q));if(created&&it.date<created)throw Error('접수일보다 앞선 날짜는 보완할 수 없습니다.');if(it.date>today())throw Error('오늘 이후 날짜는 보완할 수 없습니다.');
  const at=new Date().toISOString(),p=patchFor(q);p.memoReview=p.memoReview||{promises:{}};
  const before=JSON.parse(JSON.stringify(p.memoReview));
  p.memoReview.call={key:it.key,res:'',on_date:it.date,src:it.sentence,at,by:meName(),orig:cur.orig||''};
  note(q,'[메모 통화 보완] 메모에서 찾은 '+md(it.date)+' 통화로 실제 연결일을 보완했습니다 — 원래 값: '+(cur.orig?md(cur.orig)+(cur.state==='copy'?' (접수일 복사)':''):'없음'),at);
  save();
  if(UUID.test(String(q.id||'')))queue({type:'call_supplement',inquiry_id:String(q.id),item_key:it.key,on_date:it.date,source_text:it.sentence.slice(0,600),original_at:cur.orig||'',request_id:uuid()});
  void before;return true;
 }
 /* 약속 한 줄 판단: 완료 · 미완료 · 확인 불가 */
 function promiseDecide(q,o){
  const res=String(o.res||'');if(!['완료','미완료','확인 불가'].includes(res))throw Error('완료 · 미완료 · 확인 불가 중에서 골라 주세요.');
  if(!canEdit(q))throw Error(root.inquiryAssigned(q)?'담당 또는 관리자만 판단할 수 있습니다.':'담당이 정해진 뒤에 판단할 수 있습니다.');
  const it=scan(q).promises.find(c=>c.key===o.key);if(!it)throw Error('약속을 찾지 못했습니다.');
  const at=new Date().toISOString(),p=patchFor(q);p.memoReview=p.memoReview||{promises:{}};p.memoReview.promises=p.memoReview.promises||{};
  const had=p.memoReview.promises[it.key],prev=review(q).promises[it.key];
  /* 미완료 = 지금 할 일로 등록(같은 건에서 미완료로 고른 약속을 한 문장으로 모은다). 등록이 안 되면 판단도 저장하지 않는다 */
  if(res==='미완료'){
   const mine=promises(q).filter(x=>x.key!==it.key&&x.res==='미완료').map(x=>x.title).concat([it.title]);
   let old='',oldDue='';try{const a=root.actionObj(q,root.itemPatch(q,'inq'));if(a&&a.text){old=String(a.text);oldDue=String(a.due||'').slice(0,10);}}catch(e){}
   const keepOld=old&&old.indexOf(MARK)!==0?' (기존: '+old+')':'';
   const text=(MARK+' '+mine.join(' · ')+' 다시 확인'+keepOld).slice(0,500),due=oldDue&&oldDue<today()&&old.indexOf(MARK)!==0?oldDue:today();
   let ok=false;
   try{ok=root.InquiryCommand.run('next_set',q,{text,due})===true;}catch(e){throw Error(e&&e.message||'지금 할 일로 등록하지 못했습니다.');}
   if(!ok)throw Error('지금 할 일로 등록하지 못했습니다 — 연결을 확인해 주세요.');
  }
  p.memoReview.promises[it.key]={res,title:it.title,src:it.sentence,on_date:it.date||'',at,by:meName()};
  note(q,'[과거 약속 확인] '+it.title+' — '+res+(res==='미완료'?' · 지금 할 일로 등록':res==='확인 불가'?' · 첫 통화에서 물어볼 것':' · 기록만')+(prev&&prev.res&&prev.res!==res?' (이전: '+prev.res+')':''),at);
  void had;save();
  if(UUID.test(String(q.id||'')))queue({type:'promise',inquiry_id:String(q.id),item_key:it.key,title:it.title,source_text:it.sentence.slice(0,600),on_date:it.date||'',result:res,request_id:uuid()});
  return true;
 }
 const HANDLERS={call_supplement:callSupplement,promise:promiseDecide};
 const run=(type,q,o)=>{const fn=HANDLERS[type];if(!fn)throw Error('알 수 없는 저장 명령입니다: '+type);if(!q)throw Error('문의를 찾지 못했습니다.');return fn(q,o||{});};
 /* ── 화면 조각(견적문의 v4 상세가 끼워 쓴다 · 누르는 곳은 data-i4 로 v4 가 받는다) ── */
 function datesHtml(q){
  if(!on())return '';const D=dates(q),c=D.conn;if(!hasMemo(q)&&c.state!=='copy'&&c.state!=='supplemented')return '';
  const cell=(l,v,s,col)=>'<div class="im-cell"><span>'+esc(l)+'</span><b style="color:'+col+'">'+esc(v)+'</b><small>'+esc(s)+'</small></div>';
  let conn;
  if(c.state==='copy')conn=cell('실제 연결일','확인 필요','지금 '+md(c.orig)+'로 저장됨 = 접수일 복사','#c0392b');
  else if(c.state==='supplemented')conn=cell('실제 연결일',ymd(c.day),'메모 통화로 보완 · 원래 값 '+(c.orig?md(c.orig):'없음')+' 이력에 남음','#15171c');
  else if(c.state==='ok')conn=cell('실제 연결일',ymd(c.day),'통화 연결 · 회신 · 미팅 기록','#15171c');
  else conn=cell('실제 연결일','아직 없음','통화 연결 · 회신 기록이 생기면 표시','#6b7280');
  return '<div class="i4-sec im-dates"><b class="lb">날짜 <span>접수일 · 실제 연결일 · 메모 속 통화를 따로 봅니다</span></b><div class="im-d3">'
   +cell('접수일',ymd(D.recv)||'—','구글시트 접수 · 바뀌지 않음','#15171c')+conn
   +cell('메모 속 통화',D.memoCall?ymd(D.memoCall.date):'—',D.memoCall?'이관 메모에서 찾음 · 보완 후보':'메모에서 찾은 통화 없음',D.memoCall?'#15171c':'#6b7280')
   +'</div></div>';
 }
 function memoHtml(q){
  if(!on())return '';const sc=scan(q);if(!sc.memos.length)return '';
  const c=connection(q),edit=canEdit(q),need=c.state!=='ok'&&c.state!=='supplemented';
  const cards=sc.memos.slice(0,3).map(m=>{
   const btns=m.calls.filter(x=>x.date).slice(0,2).map(x=>{
    const done=c.state==='supplemented'&&c.day===x.date;
    return '<button type="button" class="im-btn" data-i4="memo-call" data-v="'+attr(x.key)+'"'+(done||!need||!edit?' disabled':'')+(!edit&&need?' title="'+attr(root.inquiryAssigned(q)?'담당 또는 관리자만 보완할 수 있습니다':'담당이 정해진 뒤에 보완할 수 있습니다')+'"':'')+'>'+(done?md(x.date)+' 통화로 보완됨':md(x.date)+' 통화로 실제 연결일 보완')+'</button>';}).join('');
   return '<div class="im-card"><span class="im-src">'+esc(m.src)+(m.at?' · '+esc(ymd(m.at)):'')+' · 원문</span><p class="im-raw">'+m.html+'</p>'
    +'<div class="im-leg"><span><i class="c"></i>통화 기록 후보 <i class="p"></i>약속 후보</span><em></em>'+btns+'</div></div>';}).join('');
  return '<div class="i4-sec im-memo">'+cards+'<small class="im-note">보완하면 \'실제 연결\'이 메모 속 통화일로 바뀌고 원래 값은 이력에 남습니다 · 규칙이 찾은 후보만 표시하며 확정은 담당이 합니다'+(need&&!edit?' · '+(root.inquiryAssigned(q)?'담당 또는 관리자만 누를 수 있습니다':'담당이 정해진 뒤에 보완할 수 있습니다'):'')+'</small></div>';
 }
 function promiseHtml(q,err){
  if(!on())return '';const P=promises(q);if(!P.length)return '';
  const edit=canEdit(q),done=P.filter(p=>p.res).length,RES={'완료':['완료 기록 · 업무 안 만듦','#1f7a4d'],'미완료':['미완료 · 지금 할 일로 등록 → "'+MARK+' … 다시 확인"','#b42318'],'확인 불가':['확인 불가 · 첫 통화에서 물어볼 것에 추가','#6b7280']};
  const items=P.map(p=>{
   const r=p.res?RES[p.res]:['아직 판단 안 함','#9ca3af'];
   return '<div class="im-p"><div class="im-pt"><b>'+esc(p.title)+'</b><span>'+esc('메모'+(p.memoAt?' '+ymd(p.memoAt):'')+' · "'+p.phrase.trim()+'"')+'</span></div>'
    +'<div class="im-ps">'+['완료','미완료','확인 불가'].map(l=>'<button type="button" class="'+(p.res===l?'on':'')+'" data-i4="promise" data-key="'+attr(p.key)+'" data-v="'+attr(l)+'" aria-pressed="'+(p.res===l)+'"'+(edit?'':' disabled')+'>'+l+'</button>').join('')+'</div>'
    +'<span class="im-pr" style="color:'+r[1]+'">'+esc(r[0])+'</span></div>';}).join('');
  const A=asks(q);
  return '<div class="i4-sec im-prom"><b class="lb">과거 약속 확인함 <em>'+done+' / '+P.length+'</em></b><span class="im-sub">메모에서 찾은 약속 · 바로 업무로 만들지 않음'+(edit?'':' · '+(root.inquiryAssigned(q)?'담당 또는 관리자만 판단할 수 있습니다':'담당이 정해진 뒤에 판단할 수 있습니다'))+'</span>'+items
   +(A.length?'<div class="im-ask"><b>첫 통화에서 물어볼 것</b>'+A.map(p=>'<span>· '+esc(p.title)+' — 했는지 확인</span>').join('')+'</div>':'')
   +(err?'<div class="i4-err">'+esc(err)+'</div>':'')+'</div>';
 }
 /* ── 연락처 없는 과거 문의: 이관 기록 · 같은 현장에서 번호 후보 찾기(후보만 — 저장은 담당이 [이 번호로 저장]) ── */
 const PHONE_RE=/(?:\+?82[-\s]?)?0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}/g;
 const siteKey=s=>{const t=String(s||'').replace(/^\s*\[[^\]]*\]\s*/,'').replace(/\s+/g,'');return !t||/미입력|미기재|미확인/.test(t)?'':t;};
 const phoneText=d=>{try{if(root.phoneFmt)return root.phoneFmt(d);}catch(e){}return d.length===11?d.replace(/(\d{3})(\d{4})(\d{4})/,'$1-$2-$3'):d.length===10?(d.startsWith('02')?d.replace(/(\d{2})(\d{4})(\d{4})/,'$1-$2-$3'):d.replace(/(\d{3})(\d{3})(\d{4})/,'$1-$2-$3')):d.length===9?d.replace(/(\d{2})(\d{3})(\d{4})/,'$1-$2-$3'):d;};
 function phones(q){
  const out=new Map(),add=(v,from)=>{let d=String(v||'').replace(/\D/g,'');if(d.startsWith('82'))d='0'+d.slice(2);if(!/^0\d{8,10}$/.test(d)||out.has(d))return;out.set(d,{digits:d,text:phoneText(d),from});};
  Object.values(rawOf(q)).forEach(v=>{if(typeof v==='string')(v.match(PHONE_RE)||[]).forEach(m=>add(m,'이관 메모 · 시트 원문'));});
  memosOf(q).forEach(m=>(m.text.match(PHONE_RE)||[]).forEach(x=>add(x,'이관 메모 · 시트 원문')));
  const site=siteKey(q.site||q.site_name);
  if(site&&root.B){
   (root.B.inquiries||[]).forEach(o=>{if(o!==q&&String(o.id||'')!==String(q.id||'')&&siteKey(o.site||o.site_name)===site)add(o.phone||o.contact_phone,'같은 현장 다른 문의');});
   (root.B.deals||[]).forEach(d=>{if(siteKey(d.site||d.site_name)===site)[d.manager_mobile,d.manager_phone,d.phone].forEach(p=>add(p,'같은 현장 영업건'));});
  }
  return [...out.values()];
 }
 function findHtml(q,open,canSave,err){
  if(!on())return '';const list=open?phones(q):[];
  return '<div class="i4-sec im-find"><b class="lb">연락처 보완 · 이관 기록 확인 <span>연락처가 없어 연락할 수 없습니다 — 이관 기록에서 번호를 찾아 보세요</span></b>'
   +'<div class="im-fr"><button type="button" class="im-btn" data-i4="phone-find" aria-expanded="'+!!open+'">연락처 찾기</button><small>찾아서 저장하면 후속 연락 목록으로 옮겨집니다</small></div>'
   +(open?(list.length?list.map(p=>'<div class="im-ph"><b>'+esc(p.text)+'</b><span>'+esc(p.from)+'</span><button type="button" class="im-btn" data-i4="phone-save" data-v="'+attr(p.text)+'"'+(canSave?'':' disabled')+'>이 번호로 저장</button></div>').join(''):'<span class="im-none">이관 기록 · 같은 현장에서 찾은 번호가 없습니다 — [전체 상세 ↗]에서 직접 입력해 주세요</span>'):'')
   +(err?'<div class="i4-err">'+esc(err)+'</div>':'')+'</div>';
 }
 return {on,day,diff,days,md,ymd,hm,span,today,phones,findHtml,addDays,parse,marked,sentences,memosOf,scan,promises,pending,pendingN,asks,connection,dates,copied,memoCallDay,hasMemo,opener,canEdit,review,run,load,flush,warm,takeServer,datesHtml,memoHtml,promiseHtml,RPC,LIST,MARK,_srv:SRV};
});
