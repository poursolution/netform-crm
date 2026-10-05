/* 문자 · 캠페인 v2 (2026-10-01 디자인 핸드오프 'design_handoff_sms') — 문자메시지 관리 메뉴(첫 화면 + 문자 보내기 창)만.
   목록: 공통 필터줄 → 안내 줄(병목·시즌·장기 관계·재활성 알약, + 문자 보내기 · 발송 이력) → 진단 → 묶음 표(한 줄 = 한 번 보낼 대상 묶음)
   보내기 창(760px): 단계 막대 5칸 · 대상 요약 · 목적 · 문구(변수 칩·바이트·추천 문구) · 핸드폰 미리보기 · 지금/예약 · 테스트 발송
   대상 추출(campaignAllTargets)·수신동의/번호/빈도 검수(campaignGuard)·개인화(campaignPersonalize)·추천 문구(campaignTemplateSet)·발송 요청(campaignQueue)·발송 이력은 기존 그대로.
   실제 발송 요청은 기존 campaignQueue 하나만 거친다(최종 확인란 필수). 발신번호·무료수신거부 번호는 설정값이 있을 때만 표시한다(예시 번호를 넣지 않는다).
   끄기: G.smsV2Off=true → 예전 화면. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const GROUPS=[['now','지금 보낼 때','#3b6ce4','병목이 쌓였거나 시즌이 다가온 묶음'],['soon','다가오는 시즌','#f5a524','미리 문구를 준비할 묶음'],['keep','정기 관계 문자','#30a46c','1 · 2 · 3년 장기 관계 유지'],['re','재활성','#c4c8d0','실주 · 휴면 · 무응답 고객 다시 깨우기']];
 const KIND={now:['병목','b'],soon:['시즌','o'],keep:['장기 관계','g'],re:['재활성','m']};
 /* 묶음 = 기존 대상 선택 칩(category key) 그대로 */
 const BUNDLES=[
  ['now','sent','자료 발송 후 무응답 — 후속 안내','영업팀','지금'],['now','silent','관계관리 침묵 — 안부 · 장기수선 안내','영업팀','지금'],['now','consult','컨설팅 설계 — 현장 점검 제안','영업팀','이번 주'],['now','aftercare','준공 고객 하자 점검 안내','확장관리','준공 후 1개월'],
  ['soon','yearend','연말 인사 + 내년 장기수선 반영 안내','전체','season'],['soon','lunar','설 인사','전체','season'],['soon','chuseok','추석 인사','전체','season'],
  ['keep','y1','관계 1년 — 감사 · 점검 안내','관계관리','매월'],['keep','y2','관계 2년 — 시공 사례 소개','관계관리','매월'],['keep','y3','관계 3년 — 재시공 시기 안내','관계관리','매월'],
  ['re','lost','실주 고객 — 재제안 시기 안내','영업팀','실주 후 6개월'],['re','dormant','장기 휴면 단지 — 장기수선 일정 확인','고객 자산','분기 1회'],['re','noresponse','무응답 고객 — 채널 변경','영업팀','이번 달']];
 const GRID='minmax(0,1.6fr) 80px 70px 120px 110px 100px 84px',COLS=['구분','대상','발송 가능','보낼 때','마지막 발송'];
 /* 명절 날짜(양력) — 표시용 */
 const HOLIDAY={lunar:{2027:'2027-02-07',2028:'2028-01-27',2029:'2029-02-13'},chuseok:{2026:'2026-09-25',2027:'2027-09-15',2028:'2028-10-03',2029:'2029-09-22'}};
 const enabled=()=>!root.G.smsV2Off;
 const toast=(m,t)=>{if(typeof root.toast==='function')root.toast(m,t);};
 const optOut=()=>{try{return String(root.REL_FREE_OPTOUT||root.Phase1?.storage?.getItem('nf_rel_free_optout')||'').trim();}catch(e){return '';}};
 const sender=()=>{const v=String(root.campaignSenderNumber?.()||'').trim();return /\d{2,}/.test(v)?v:'';};
 function season(key){
  const now=new Date(),y=now.getFullYear(),day=d=>Math.ceil((new Date(d+'T00:00:00')-now)/864e5);
  if(key==='yearend'){const d=y+'-12-15',n=day(d);return n>=0?{text:'12월 15일',sub:'D-'+n,past:false}:{text:'지남 · 12월 15일',sub:'내년 준비',past:true};}
  const table=HOLIDAY[key]||{},cur=table[y],next=table[y+1];
  if(cur&&day(cur)>=0)return {text:cur.slice(5).replace('-','월 ').replace(/^0/,'')+'일',sub:'D-'+day(cur),past:false};
  if(cur&&next&&day(next)>200)return {text:'지남 · '+Number(cur.slice(5,7))+'월 '+Number(cur.slice(8))+'일',sub:'내년 준비',past:true};
  if(next)return {text:next,sub:'D-'+day(next),past:false};
  return {text:'일정 미정',sub:'',past:true};
 }
 /* 묶음별 대상: 기존 추출 함수를 묶음 키로 돌린다(공통 브랜드·담당자·검색 조건 적용) */
 function targetsOf(key){
  const G=root.G,old=G.campaignCategory;let list=[];
  try{G.campaignCategory=key;list=root.campaignAllTargets();}finally{G.campaignCategory=old;}
  const owner=root.SalesScope.state().owner||'전체',q=String(G.q||'').trim().toLowerCase();
  return list.filter(t=>(!root.campaignTargetMatches||root.campaignTargetMatches(t))&&root.SalesFilterState.matchesBrand(t.brand)&&(owner==='전체'||t.owner===owner)&&(!q||[t.deal.site,t.contact.name,t.contact.mobile,t.owner].join(' ').toLowerCase().includes(q)));
 }
 function lastSent(key){const rows=(root.campaignLogs?.()||[]).filter(x=>x.category_key===key).map(x=>String(x.created_at||x.createdAt||'')).sort();return rows.length?rows[rows.length-1].slice(0,10):'';}
 function model(){
  const rows=BUNDLES.map(([group,key,name,source,when])=>{const t=targetsOf(key),s=when==='season'?season(key):null;return {group,key,name,source,when:s?s.text:when,sub:s?s.sub:'',past:!!(s&&s.past),total:t.length,ready:t.filter(x=>x.guard.ok).length,last:lastSent(key)};});
  return {rows,all:targetsOf('all')};
 }
 function brandStats(){
  const sel=root.SalesFilterState.state().brands||[];let list=[];const G=root.G,old=G.campaignCategory;
  try{G.campaignCategory='all';list=root.campaignAllTargets();}catch(e){list=[];}finally{G.campaignCategory=old;}
  const names=[...new Set(['석민이앤씨','POUR솔루션','POUR공법','아파트스퀘어'].concat(list.map(t=>t.brand).filter(Boolean)))];
  return [{name:'전체',n:list.length,on:!sel.length}].concat(names.map(b=>({name:b,n:list.filter(t=>t.brand===b).length,on:sel.includes(b)})));
 }
 function diagnosis(m){
  const D=root.PipelineDiagnosis;if(!D)return '';
  const all=m.all,ready=all.filter(t=>t.guard.ok).length,blocked=all.length-ready,L=root.campaignLogs?.()||[],month=new Date().toISOString().slice(0,7),mr=L.filter(x=>String(x.created_at||x.createdAt||'').slice(0,7)===month);
  const sent=mr.reduce((a,x)=>a+root.campaignDeliveredCount(x),0),sum=k=>mr.reduce((a,x)=>a+Number(x[k]||0),0),scheduled=L.filter(x=>x.status==='scheduled').length,failed=L.filter(x=>x.status==='failed'||root.campaignNeedsReview(x)).length;
  const why=new Map();all.filter(t=>!t.guard.ok).forEach(t=>why.set(t.guard.label,(why.get(t.guard.label)||0)+1));
  const hint={'문자 수신동의 없음':'동의 확보 필요','휴대폰번호 없음':'연락처 보완','휴대폰 형식 확인':'번호 확인','고객 식별정보 없음':'연락처 등록 필요','수신거부':'발송 제외','최근 30일 과다발송':'빈도 제한'};
  const K=(label,value,sub,tone)=>({label,value,sub,tone:tone||''});
  const ye=season('yearend'),noConsent=why.get('문자 수신동의 없음')||0;
  const tasks=[[all.length&&!ready?1:0,'발송 가능 0명','연락처 등록 시 수신 동의를 함께 받기 (연락처 패널)','영업팀','발송 가능 0명'],[noConsent,'동의 없는 '+noConsent+'명','다음 통화 때 문자 수신 동의를 확인해 연락처에 기록','영업팀 · 연락 결과','수신 동의 없음'],[ye.past?0:1,'연말 인사 '+ye.sub,'12월 1일까지 문구 확정 · 테스트 발송','마케팅 · 11월','연말 인사'],[sent&&!sum('response_count')?1:0,'발송 '+sent+'건 · 응답 0','문자 응답을 해당 영업건의 연락 기록 · 다음 할 일로 남기기','영업팀','응답 추적']].filter(t=>t[0]>0).map(t=>({basis:t[1],todo:t[2],who:t[3],label:t[4],count:t[0]}));
  return D.render({accent:'blue',
   kpis:[K('보낼 대상',all.length.toLocaleString('ko-KR')+'명','관리 대상 연락처'),K('발송 가능',ready.toLocaleString('ko-KR')+'명',blocked?blocked.toLocaleString('ko-KR')+'명 자동 제외':'자동 제외 없음',all.length&&!ready?'bad':''),K('이번 달 발송',sent+'건','예약 대기 '+scheduled+' · 실패·확인 '+failed),K('발송 → 응답',sum('response_count')+'건','다음 할 일 생성 '+sum('next_action_count')+' · 단계 진전 '+sum('stage_advanced_count'),sent&&!sum('response_count')?'warn':'')],
   cards:[{title:'어디에 보낼까',desc:'묶음별 대상 수',bars:m.rows.filter(r=>r.total).sort((a,b)=>b.total-a.total).slice(0,5).map(r=>[r.name.split(' — ')[0],r.total,'가능 '+r.ready])},{title:'언제 보낼까',desc:'다가오는 시즌 · 정기',rows:m.rows.filter(r=>r.group==='soon'||r.group==='keep').map(r=>[r.name.split(' — ')[0],r.total,r.group==='soon'?(r.sub||r.when):'매월'])},{title:'왜 못 보내나',desc:'자동 제외 사유',rows:[...why].sort((a,b)=>b[1]-a[1]).map(([k,n])=>[k,n,hint[k]||'확인 필요']),empty:'자동 제외된 대상이 없습니다'}],
   action:{title:'그래서 뭘 해야 하나',desc:'발송 병목에서 나온 과제',tasks}},{open:true,noToggle:true,scope:'sms'});
 }
 function rowHtml(r){
  const k=KIND[r.group];
  return '<div class="plv-row" role="row" tabindex="0" data-sv="send" data-value="'+attr(r.key)+'" data-bundle="'+attr(r.key)+'" style="grid-template-columns:'+GRID+'"><span class="plv-c plv-site"><b title="'+attr(r.name)+'">'+h(r.name)+'</b><small>'+h(r.source)+'</small></span>'
   +'<span class="plv-c"><em class="plv-tag '+k[1]+'">'+k[0]+'</em></span>'
   +'<span class="plv-c"><span>'+r.total.toLocaleString('ko-KR')+'명</span></span>'
   +'<span class="plv-c"><span class="'+(r.ready?'':'r')+'">'+r.ready.toLocaleString('ko-KR')+'명</span></span>'
   +'<span class="plv-c"><span class="'+(r.past?'m':'')+'">'+h(r.when)+'</span>'+(r.sub?'<small>'+h(r.sub)+'</small>':'')+'</span>'
   +'<span class="plv-c"><span class="'+(r.last?'':'m')+'">'+h(r.last||'기록 없음')+'</span></span>'
   +'<button type="button" class="plv-cta" data-sv="send" data-value="'+attr(r.key)+'">보내기</button></div>';
 }
 function listHtml(m){
  const f=root.G.smsGroup||'all',rows=m.rows.filter(r=>f==='all'||r.group===f);
  const pills='<div class="plv-pills" role="group" aria-label="묶음 구분">'+[['all','전체',m.rows.length]].concat(GROUPS.map(g=>[g[0],KIND[g[0]][0],m.rows.filter(r=>r.group===g[0]).length])).map(([v,t,n])=>'<button type="button" data-sv="group" data-value="'+v+'" aria-pressed="'+(f===v)+'">'+h(t)+' <b>'+n+'</b></button>').join('')+'</div>';
  const intro='<div class="plv-intro"><i style="background:#64748b"></i><b>문자 · 캠페인</b><span>병목 · 시즌 · 장기 관계별로 대상을 모아 한 번에 보내는 곳</span><div class="plv-spacer"></div>'+pills+'<button type="button" class="sv-ghost" data-sv="history">발송 이력</button><span class="cm-test-slot sv-test"></span><button type="button" class="sv-primary" data-sv="new">+ 문자 보내기</button></div>';
  const head='<div class="plv-thead" role="row" style="grid-template-columns:'+GRID+'"><span>묶음 이름 · 출처</span>'+COLS.map(c=>'<span>'+h(c)+'</span>').join('')+'<span></span></div>';
  const groups=GROUPS.filter(g=>f==='all'||g[0]===f).map(([id,title,color,desc])=>{const list=rows.filter(r=>r.group===id);return '<div class="plv-ghead" data-plv-group="'+id+'"><i style="background:'+color+'"></i><b>'+h(title)+'</b><span>'+list.length+'건</span><small>· '+h(desc)+'</small></div>'+(list.length?list.map(rowHtml).join(''):'<div class="plv-empty">해당하는 건이 없습니다</div>');}).join('');
  return '<div id="sms-v2" class="plv" data-workspace="sms">'+intro+diagnosis(m)+'<div class="plv-table" role="table" aria-label="문자 대상 묶음">'+head+groups+'</div></div>';
 }
 function onClick(e){
  const pd=e.target.closest('[data-pd="toggle"]');if(pd&&pd.closest('#sms-v2')){root.G.plvDiagShut=root.G.plvDiagShut!==true;root.paintCampaign();return;}
  const b=e.target.closest('#sms-v2 [data-sv]');if(!b)return;const a=b.dataset.sv,v=b.dataset.value;
  if(a==='group'){root.G.smsGroup=v;root.paintCampaign();}
  if(a==='history')root.campaignSetTab('history');
  if(a==='new')root.campaignStart();/* 빈 묶음으로 시작 = 기존 대상 선택부터 */
  if(a==='send')open(v);
 }
 function paintList(host){
  const test=host.querySelector('.pc-message-test-entry');
  host.innerHTML=listHtml(model());
  if(test){test.className='sv-ghost pc-message-test-entry';host.querySelector('.sv-test')?.append(test);}
  if(!host.__sv){host.__sv=true;host.addEventListener('click',onClick);host.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList?.contains('plv-row')){e.preventDefault();e.target.click();}});}
  if(root.G.page==='campaign'){const t=document.getElementById('ptitle'),p=document.getElementById('psub');if(t)t.textContent='문자 · 캠페인';if(p)p.textContent='병목 · 시즌 · 장기 관계별로 대상을 모아 한 번에 보내는 곳';}
 }
 /* ── 문자 보내기 창 ── */
 const PURPOSES=['안부 · 관계','점검 안내','시즌 인사','재제안'];
 const DEFAULT_PURPOSE={sent:'점검 안내',silent:'안부 · 관계',consult:'점검 안내',aftercare:'점검 안내',yearend:'시즌 인사',lunar:'시즌 인사',chuseok:'시즌 인사',y1:'안부 · 관계',y2:'안부 · 관계',y3:'안부 · 관계',lost:'재제안',dormant:'재제안',noresponse:'재제안'};
 const VARS=[['이름','[고객호칭]'],['현장','[현장명]'],['담당자','[담당자명]'],['공종','[공종요약]']];
 let S=null;
 /* 목적별 추천 문구 — 목적 칩을 누르면 추천 문구와 본문이 그 목적으로 바뀐다. 시즌 묶음의 시즌 인사는 기존 문구(명절 이름 포함)를 그대로 쓴다 */
 const N='[고객호칭]',ST='[현장명]',RP='[담당자명]',WK='[공종요약]',CO='[회사명]';
 const PURPOSE_SET={'안부 · 관계':[['안부형',N+' 안녕하세요. '+CO+' '+RP+'입니다. '+ST+' 관련해 안부드리며, 검토 중인 내용에 변동이 있으신지 편하실 때 알려주세요.'],['계획 변화 확인',N+', '+ST+'의 올해 공사계획이나 예산 일정에 변동이 있으신지 확인드립니다. '+WK+' 관련해서 필요하신 자료가 있으면 준비하겠습니다.'],['기존 공종 재확인',N+' 안녕하세요. 이전에 말씀 나눈 '+WK+' 건은 현재 어떻게 검토되고 있으신가요? 일정에 맞춰 다시 도와드리겠습니다.']],
  '점검 안내':[['현장 점검 제안',N+' 안녕하세요. '+CO+' '+RP+'입니다. '+ST+' '+WK+' 관련해 현장 상태를 한 번 점검해 드리고자 합니다. 편하신 일정을 알려주시면 맞춰 방문하겠습니다.'],['자료 확인',N+' 안녕하세요. '+ST+' 관련 자료를 전달드렸습니다. 받아 보셨는지, 추가로 필요한 내용이 있으신지 확인 부탁드립니다.'],['장기수선 점검 안내',N+', '+ST+'의 장기수선계획 검토 시기에 맞춰 '+WK+' 점검 내용을 정리해 드릴 수 있습니다. 필요하시면 회신 부탁드립니다.']],
  '시즌 인사':[['정중한 인사',N+', 늘 건강과 평안을 기원드립니다. 항상 감사드립니다. '+CO+' '+RP+' 드림'],['고객 안부',N+' 안녕하세요. 계절이 바뀌는 때에 '+ST+' 모든 분께 좋은 일만 가득하시길 바랍니다.'],['짧은 인사',N+', 건강 유의하시고 좋은 하루 보내세요. 늘 감사드립니다. '+CO+' '+RP+' 드림']],
  '재제안':[['가벼운 재접촉',N+' 안녕하세요. '+CO+' '+RP+'입니다. '+ST+' '+WK+' 건의 최근 계획을 여쭙고자 연락드렸습니다.'],['변화 확인',N+', 이전에 논의한 '+ST+' 건이 현재도 검토 중인지 확인드립니다. 보류 또는 변경 사항만 알려주셔도 됩니다.'],['확장 제안',N+' 안녕하세요. '+ST+'의 기존 이력을 살펴보다 '+WK+' 외에 함께 점검할 수 있는 항목이 있어 안내드립니다. 필요하시면 간단히 정리해 드리겠습니다.']]};
 function templates(){
  if(S.purpose==='시즌 인사'&&DEFAULT_PURPOSE[S.key]==='시즌 인사'){const G=root.G,old=G.campaignCategory;try{G.campaignCategory=S.key;return root.campaignTemplateSet();}finally{G.campaignCategory=old;}}
  const i=PURPOSES.indexOf(S.purpose);return (PURPOSE_SET[S.purpose]||[]).map((x,n)=>({key:S.key+'-p'+i+'-'+n,title:x[0],body:x[1],category:S.key,label:S.purpose}));
 }
 function finalBody(){const o=optOut();return S.body+(S.ad&&o&&S.body.trim()?'\n무료수신거부 '+o:'');}
 function sample(){const t=S.ready[0]||S.targets[0],b=finalBody();return t&&b.trim()?root.campaignPersonalize(b,t):b;}
 function dialogHtml(){
  const bundle=BUNDLES.find(b=>b[1]===S.key),total=S.targets.length,ready=S.ready.length,blocked=total-ready,why=new Map();S.targets.filter(t=>!t.guard.ok).forEach(t=>why.set(t.guard.label,(why.get(t.guard.label)||0)+1));
  const text=sample(),bytes=root.campaignBytes(text),step=!ready?0:!S.body.trim()?2:S.confirmed?4:3,first=S.ready[0]||S.targets[0],o=optOut(),from=sender();
  const steps=['대상','목적','문구','미리보기','발송'].map((n,i)=>'<div class="'+(i<step?'done':i===step?'cur':'')+'"><i></i><span>'+(i===step?'지금 · ':'')+n+'</span></div>').join('');
  const T=templates();
  const now=new Date(),clock=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  return '<header class="sd-head"><div><small>문자 보내기</small><h2 id="sdTitle">'+h(S.title||(bundle?bundle[2]:'문자 보내기'))+'</h2></div><button type="button" class="sv-ghost" data-sd="history">발송 이력</button><button type="button" class="xdv-close" data-sd="close" aria-label="닫기">✕</button></header>'
   +'<div class="idv-steps sd-steps">'+steps+'</div>'
   +'<div class="sd-body"><div class="sd-sum"><div><span>대상</span><b>'+total.toLocaleString('ko-KR')+'명</b></div><div class="'+(ready?'':'bad')+'"><span>발송 가능</span><b>'+ready.toLocaleString('ko-KR')+'명</b></div><div class="warn"><span>자동 제외</span><b>'+blocked.toLocaleString('ko-KR')+'명</b></div></div>'
   +(blocked?'<p class="sd-why">자동 제외 — '+[...why].sort((a,b)=>b[1]-a[1]).map(([k,n])=>h(k)+' '+n+'명').join(' · ')+'</p>':'')
   +'<div class="plv-pills sd-purpose" role="group" aria-label="발송 목적">'+PURPOSES.map(p=>'<button type="button" data-sd="purpose" data-value="'+attr(p)+'" aria-pressed="'+(S.purpose===p)+'">'+h(p)+'</button>').join('')+'</div>'
   +'<div class="sd-two"><div class="sd-left"><textarea id="sd-body" rows="5" aria-label="문구" placeholder="보낼 문구를 입력하거나 아래 추천 문구를 고르세요">'+h(S.body)+'</textarea>'
   +'<div class="sd-vars"><span>넣기</span>'+VARS.map(v=>'<button type="button" data-sd="var" data-value="'+attr(v[1])+'">{'+v[0]+'}</button>').join('')+'<em class="'+(bytes>90?'lms':'sms')+'" id="sd-bytes">'+(bytes>90?'LMS · '+bytes+' byte':'SMS · '+bytes+'/90 byte')+'</em></div>'
   +'<div class="sd-recs">'+T.map(t=>'<button type="button" class="sd-rec'+(S.templateKey===t.key?' on':'')+'" data-sd="rec" data-value="'+attr(t.key)+'"><b>'+h(t.title)+(S.templateKey===t.key?' <u>선택됨</u>':'')+'</b><span>'+h(t.body)+'</span></button>').join('')+'</div>'
   +'<label class="sd-check"><input type="checkbox" id="sd-ad"'+(S.ad?' checked':'')+(o?'':' disabled')+'> 광고성 문구면 끝에 무료수신거부 번호를 붙인다'+(o?' ('+h(o)+')':' — <b>무료수신거부 번호가 아직 등록되지 않았습니다</b>')+'</label></div>'
   +'<div class="sd-phone" aria-label="받는 사람 화면 미리보기"><div class="sd-status"><span>'+clock+'</span><i></i><span>LTE</span></div><div class="sd-from"><em>넷</em><div><b>넷폼</b><small>'+h(from||'등록 발신번호')+'</small></div></div><div class="sd-day">오늘</div><div class="sd-thread"><div class="sd-bubble'+(text.trim()?'':' empty')+'" id="sd-bubble">'+h(text.trim()?text:'문구를 입력하면 고객이 받는 모습 그대로 보입니다.')+'</div></div><div class="sd-meta">'+(first?h(first.contact.name||'받는 분')+' · '+h(first.deal.site||''):'대상 없음')+'</div><div class="sd-input">문자 메시지</div><div class="sd-home"></div></div></div>'
   +'<div class="sd-send"><div class="sd-modes" role="radiogroup" aria-label="발송 시점"><button type="button" data-sd="mode" data-value="now" aria-pressed="'+(S.mode==='now')+'">지금</button><button type="button" data-sd="mode" data-value="schedule" aria-pressed="'+(S.mode==='schedule')+'">예약</button></div>'+(S.mode==='schedule'?'<input type="datetime-local" id="sd-at" aria-label="예약 시각" value="'+attr(S.at)+'">':'')+'</div>'
   +'<label class="sd-check sd-confirm"><input type="checkbox" id="cc-final-approval"'+(S.confirmed?' checked':'')+(ready?'':' disabled')+'> <span><b>'+h(S.purpose)+' · '+ready+'명</b>에게 보낼 문구와 대상을 최종 확인했습니다. 발송 성공은 서버 확인으로만 확정됩니다.</span></label><div class="idv-err" id="sd-err" role="alert"></div></div>'
   +'<footer class="sd-foot"><button type="button" class="sv-ghost" data-sd="test">테스트 발송</button><div class="plv-spacer"></div><button type="button" class="sv-primary'+(ready?'':' off')+'" data-sd="go"'+(ready?'':' disabled')+'>'+(ready?(S.mode==='schedule'?'예약 · ':'')+ready.toLocaleString('ko-KR')+'명에게 보내기':'발송 가능 0명 · 보낼 수 없음')+'</button></footer>';
 }
 function node(){
  let m=document.getElementById('smsDialog');if(m)return m;
  m=document.createElement('div');m.id='smsDialog';m.className='sd-layer';m.innerHTML='<section class="sd-box" role="dialog" aria-modal="true" aria-labelledby="sdTitle"></section>';
  m.addEventListener('mousedown',e=>{if(e.target===m)close();});
  m.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
  m.addEventListener('click',onDialogClick);
  m.addEventListener('input',e=>{if(e.target.id==='sd-body'){S.body=e.target.value;S.templateKey=S.templateKey&&templates().some(t=>t.key===S.templateKey&&t.body===S.body)?S.templateKey:'';live();}if(e.target.id==='sd-at')S.at=e.target.value;});
  m.addEventListener('change',e=>{if(e.target.id==='sd-ad'){S.ad=e.target.checked;live();}if(e.target.id==='cc-final-approval'){S.confirmed=e.target.checked;}});
  document.body.append(m);return m;
 }
 function live(){const m=node(),text=sample(),bytes=root.campaignBytes(text),b=m.querySelector('#sd-bubble'),n=m.querySelector('#sd-bytes');if(b){b.textContent=text.trim()?text:'문구를 입력하면 고객이 받는 모습 그대로 보입니다.';b.classList.toggle('empty',!text.trim());}if(n){n.textContent=bytes>90?'LMS · '+bytes+' byte':'SMS · '+bytes+'/90 byte';n.className=bytes>90?'lms':'sms';}}
 function render(){const box=node().querySelector('.sd-box'),y=box.querySelector('.sd-body')?.scrollTop||0;box.innerHTML=dialogHtml();const b=box.querySelector('.sd-body');if(b)b.scrollTop=y;}
 /* custom={title,keys:Set<dealKey>} — 'CRM에게 묻기' 결과 묶음처럼 화면 밖에서 고른 대상에게 보낼 때. 검수 · 발송 경로는 같다 */
 function open(key,custom,draft){
  const candidates=custom?targetsOf('all').filter(t=>custom.keys.has(root.dealKey(t.deal))):targetsOf(key),selected=draft&&Object.keys(draft.selected||{}),targets=selected&&selected.length?candidates.filter(t=>draft.selected[t.key]):candidates,d=new Date(Date.now()+864e5);d.setHours(9,0,0,0);
  S={key,title:custom?custom.title:'',targets,ready:targets.filter(t=>t.guard.ok),purpose:DEFAULT_PURPOSE[key]||PURPOSES[0],templateKey:'',body:'',ad:false,mode:'now',at:root.localDateTimeValue?root.localDateTimeValue(d):'',confirmed:false,focus:document.activeElement};
  if(draft){S.body=String(draft.body||'');S.templateKey=draft.templateKey||'';S.purpose=draft.purpose||S.purpose;S.mode=draft.sendMode==='schedule'?'schedule':'now';S.at=draft.scheduleAt||S.at;}
  const m=node();render();m.classList.add('on');m.querySelector('#sd-body')?.focus();
 }
 function close(){const m=document.getElementById('smsDialog');if(m)m.classList.remove('on');const f=S&&S.focus;S=null;if(f&&f.isConnected)f.focus?.({preventScroll:true});}
 function onDialogClick(e){
  const b=e.target.closest('[data-sd]');if(!b||!S)return;const a=b.dataset.sd,v=b.dataset.value,err=document.getElementById('sd-err');
  if(a==='close')return close();
  if(a==='history'){close();return root.campaignSetTab('history');}
  if(a==='purpose'){
   /* 직접 쓴 문구는 지키고, 비었거나 추천 문구 그대로면 새 목적의 첫 문구로 바꾼다 */
   const keep=S.body.trim()&&!templates().some(t=>t.body===S.body);S.purpose=v;S.confirmed=false;
   if(!keep){const t=templates()[0];S.templateKey=t?t.key:'';S.body=t?t.body:'';}else S.templateKey='';
   return render();
  }
  if(a==='mode'){S.mode=v;return render();}
  if(a==='rec'){const t=templates().find(x=>x.key===v);if(t){S.templateKey=t.key;S.body=t.body;render();}return;}
  if(a==='var'){const ta=document.getElementById('sd-body');S.body=(S.body||'')+v;if(ta){ta.value=S.body;ta.focus();}return live();}
  if(a==='test'){const t=document.querySelector('#campaign-root .pc-message-test-entry');if(t)t.click();else if(err)err.textContent='테스트 발송 도구를 불러오지 못했습니다.';return;}
  if(a==='go'){
   if(!S.ready.length)return;
   if(!S.body.trim()){err.textContent='보낼 문구를 입력해 주세요.';return;}
   if(!document.getElementById('cc-final-approval')?.checked){err.textContent='대상과 문구를 확인한 뒤 확인란을 선택해 주세요.';return;}
   if(S.mode==='schedule'&&!S.at){err.textContent='예약 시각을 선택해 주세요.';return;}
   /* 기존 발송 요청 함수가 읽는 상태를 그대로 채운 뒤 호출한다 — 발송 경로는 하나 */
   const G=root.G,selected={};S.ready.forEach(t=>{selected[t.key]=1;});
   G.campaignCategory=S.key;G.campaignTab='send';
   Object.assign(root.CAMPAIGN_STATE,{selected,purpose:S.purpose,templateKey:S.templateKey||'custom',body:finalBody(),scheduleAt:S.at,sendMode:S.mode,notice:''});
   const mode=S.mode,m=node();
   root.campaignQueue(mode);
   m.classList.remove('on');S=null;
   if(root.G.campaignTab==='receipt')toast((mode==='schedule'?'예약 ':'')+'발송 요청을 접수했습니다 · 발송 이력에서 결과를 확인하세요');
  }
 }
 function boot(){
  const base=root.paintCampaign;if(typeof base!=='function')return;
  root.paintCampaign=function(){
   const entering=root.G.campaignTab==='send',draft=entering?{...root.CAMPAIGN_STATE,selected:{...root.CAMPAIGN_STATE.selected}}:null;
   if(entering)root.G.campaignTab='home';
   const r=base.apply(this,arguments),pg=document.getElementById('pg-campaign'),host=document.getElementById('campaign-root'),bar=pg?.querySelector(':scope>.cf-bar'),home=(root.G.campaignTab||'home')==='home';
   if((!enabled()&&!entering)||!home||!host){pg?.classList.remove('sv-on');if(bar)bar.hidden=true;return r;}
   try{paintList(host);pg?.classList.add('sv-on');root.CommonFilterBar?.mount('campaign');const b2=pg?.querySelector(':scope>.cf-bar');if(b2)b2.hidden=false;}catch(e){console.warn('[문자 v2]',e);}
   if(entering)open(root.G.campaignCategory||'all',null,draft);
   return r;
  };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.SmsV2={enabled,open,openCustom:(title,keys)=>open('all',{title,keys}),close,brandStats,model,season};
})(window);
