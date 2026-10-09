/* Non-destructive duplicate classification. Also consumed by node:test. */
(function(root){
 'use strict';
 const norm=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[\s·.,()\[\]_-]/g,'');
 /* 빈 값 · '미입력' · '무제' 같은 표시 문구는 일치 근거가 아니다(2026-10-07 data_review_rules ①) — 둘 다 '현장명 미입력'이라고 같은 현장이 되지 않는다 */
 const blank=v=>{const n=norm(v);return !n||/^(현장명|주소|공종|연락처|고객명|이름)?미(입력|기재|기록|확인|분류|정)$/.test(n)||/^무제/.test(n)||/^(없음|해당없음|null|undefined|n\/a)$/.test(n);};
 const name=v=>blank(v)?'':norm(v).replace(/아파트/g,'');
 const phone=v=>String(v||'').replace(/\D/g,'');
 const same=(a,b)=>!!a&&!!b&&a===b;
 /* 후보 검토용 주소. 서울 행정명 표기만 통일하고 번지의 하이픈·동/호는 보존한다.
    원본 주소와 기존 현장/영업건 병합 규칙은 바꾸지 않는다. */
 const reviewAddress=v=>String(v||'').normalize('NFKC').trim().replace(/\s+/g,' ').replace(/^(서울특별시|서울시|서울)(?=\s)/,'서울');
 const grams=s=>new Set(Array.from({length:s.length-1},(_,i)=>s.slice(i,i+2)));
 /* 행마다 정규화·2-gram을 한 번만 계산해 둔다(2026-10-01 — 1,700행이면 쌍 140만 개마다 다시 계산해 데이터 정리 진입에 4.5초 걸렸다) */
 const prepared=new WeakMap();
 function prep(r){let p=prepared.get(r);if(p)return p;const n=name(r.name);p={n,g:n.length>=4?grams(n):null,addr:blank(r.address)?'':reviewAddress(r.address).toLowerCase().replace(/\s/g,''),mobile:phone(r.mobile),office:phone(r.office),work:[...new Set((r.works||[]).filter(w=>!blank(w)).map(norm))].sort().join('|'),at:Date.parse(r.at)};prepared.set(r,p);return p}
 function simPrepared(pa,pb){const a=pa.n,b=pb.n;if(!a||!b)return 0;if(a===b)return 1;if(!pa.g||!pb.g)return 0;let hit=0;for(const v of pa.g)if(pb.g.has(v))hit++;return 2*hit/(pa.g.size+pb.g.size)}
 function similarity(a,b){return simPrepared(prep({name:a}),prep({name:b}))}
 function pairKey(a,b){return [a.ref.type+':'+a.ref.id,b.ref.type+':'+b.ref.id].sort().join('|')}
 function classify(a,b){
  if(a.ref.type===b.ref.type&&String(a.ref.id)===String(b.ref.id))return null;
  if(a.ref.type==='organization'&&String(a.ref.id)===b.siteId||b.ref.type==='organization'&&String(b.ref.id)===a.siteId)return null;
  if(a.ref.type==='inquiry'&&b.ref.type==='deal'&&(a.linkedDealId===b.ref.id||b.originInquiryId===a.ref.id)||b.ref.type==='inquiry'&&a.ref.type==='deal'&&(b.linkedDealId===a.ref.id||a.originInquiryId===b.ref.id))return null;
  const pa=prep(a),pb=prep(b);
  const address=same(pa.addr,pb.addr),conflict=!!pa.addr&&!!pb.addr&&!address;
  const mobile=same(pa.mobile,pb.mobile)&&/^01\d{8,9}$/.test(pa.mobile);
  const office=same(pa.office,pb.office)&&pa.office.length>=9;
  const siteId=same(a.siteId,b.siteId),names=simPrepared(pa,pb),sameSite=siteId||address;
  const workA=pa.work,workB=pb.work;
  const differentWork=!!workA&&!!workB&&workA!==workB,differentBiz=!!a.brand&&!!b.brand&&a.brand!==b.brand;
  const da=pa.at,db=pb.at,days=Number.isFinite(da)&&Number.isFinite(db)?Math.abs(da-db)/864e5:null;
  /* 식별 근거가 없는 쌍(현장명 · 주소가 둘 다 비어 있음): 같은 전화 하나뿐이면 '확인 불가' — 같은 전화는 후보를 찾는 조건일 뿐 같은 현장의 증거가 아니다(관리소장 한 명이 여러 단지 · 공종을 문의할 수 있다) */
  if(!pa.n&&!pb.n&&!pa.addr&&!pb.addr&&!siteId&&(mobile||office)){const ty=a.ref.type===b.ref.type&&(a.ref.type==='inquiry'||a.ref.type==='deal')?a.ref.type:'site';return {key:pairKey(a,b),a,b,type:ty,action:'defer',reasons:['현장명이 둘 다 비어 있음','다른 식별 근거 없음','같은 전화는 후보 찾기에만 씀'],text:'현장명 · 주소가 비어 있어 같은 현장인지 알 수 없습니다. 자료를 보완한 뒤 판단하세요.',unknown:true};}
  const reasons=[];if(address)reasons.push('주소 동일');if(office)reasons.push('관리사무소 전화 동일');if(siteId)reasons.push('현장 ID 동일');if(names===1)reasons.push('현장명 표기 일치');else if(names>=.72)reasons.push('현장명 유사 — 확인 필요');if(conflict)reasons.push('등록 주소 서로 다름');
  let type,action,text;
  const reviewA=reviewAddress(a.address),reviewB=reviewAddress(b.address);
  const crossBrandRequest=a.ref.type==='inquiry'&&b.ref.type==='inquiry'&&differentBiz&&days!==null&&days<=1
   &&((same(reviewA,reviewB)&&/(?:로|길|동|리)\s*\d/.test(reviewA))||siteId&&!conflict);
  if(crossBrandRequest){
   type='inquiry';action='defer';
   /* 기존 norm은 번지 하이픈도 지운다. 새 후보에는 그 결과를 주소 일치 근거로 쓰지 않는다. */
   reasons.splice(0,reasons.length,...(siteId?['현장 ID 동일']:[]),...(same(reviewA,reviewB)?['주소 표기 정규화 일치']:[]),'다른 브랜드 · 1일 이내 문의 접수');
   if(a.mobile&&b.mobile&&!mobile)reasons.push('연락처 서로 다름');
   if(differentWork)reasons.push('공사 범위 확인 필요');
   text='같은 현장의 다른 브랜드 접수입니다. 같은 공사 요청인지 확인하고 두 접수·연락처·응대 이력을 보존하세요. 담당자·배드핏 등 상태는 자동으로 복사하지 않습니다.';
  }else if(mobile&&!siteId&&(conflict||names<.72)){
   type='contact';action='contact_move';reasons.push('관리소장 휴대전화 동일');text='관리소장 이동 또는 공용 연락처일 수 있습니다. 사람과 근무지만 확인하고 현장은 합치지 마세요.';
  }else if(conflict&&!siteId&&names>=.72){type='site';action='separate';text='주소가 다릅니다. 단지·동 구분을 확인하고 별도 현장으로 유지하세요.';
  }else if(a.ref.type==='inquiry'&&b.ref.type==='inquiry'&&(sameSite||names===1)&&(office||mobile||address)&&!differentWork&&!differentBiz&&days!==null&&days<=1){
   type='inquiry';action='inquiry_merge';reasons.push('1일 이내 문의 접수');text='같은 요청의 중복 접수인지 비교하세요. 추가 정보라면 원본 문의를 활동으로 연결할 수 있습니다.';
  }else if(a.ref.type==='deal'&&b.ref.type==='deal'&&(sameSite||names===1)&&!conflict&&!differentWork&&!differentBiz&&workA&&workA===workB&&days!==null&&days<=30){
   type='deal';action='deal_review';reasons.push('동일 공종 · 30일 이내 등록');text='영업기회 중복 가능성입니다. 계약·수주·활동 이력을 비교한 뒤 판단하세요. 자동 병합하지 않습니다.';
  }else if(siteId){
   return null;
  }else if((sameSite||names===1)&&!conflict&&(differentWork||differentBiz||(days!==null&&days>365))){
   type='site';action=differentWork?'site_link':'defer';
   if(differentWork)reasons.push('공종 서로 다름');
   if(differentBiz)reasons.push('사업유형 서로 다름 — 공사 차이 근거 아님');
   if(days!==null&&days>365)reasons.push('접수·등록일 1년 초과 차이 — 공사 시기 미확인');
   text='같은 현장 후보입니다. 사업유형과 접수·등록일 차이만으로 다른 공사라고 확정하지 않습니다. 공종·범위·실제 공사 시기를 확인할 때까지 개별 원본과 이력을 유지하세요.';
  }else if(!conflict&&(address||office&&names>=.72||names>=.82)){
   type='site';action=address||office?'site_merge':'defer';text=address||office?'현장 Master 통합 후보입니다. 이름·주소를 확인하고 개별 영업기회와 이력은 유지하세요.':'이름만으로 확정할 수 없습니다. 주소와 관리사무소 정보를 보완한 뒤 검토하세요.';
  }else return null;
  /* 영업 자료끼리는 현장 Master 병합 추천으로 우회하지 않는다. 현재 입력에는
     공사 범위·추진 시기의 확인 결과가 없으므로 등록일로 같은 공사를 확정하지 않는다. */
  const businessPair=[a,b].every(r=>['inquiry','deal'].includes(r.ref.type));
  if(businessPair&&action==='site_merge'){
   action='defer';text='같은 현장 후보입니다. 공종·공사 범위·실제 공사 시기를 확인한 뒤 상담 또는 현장 연결 여부를 정하세요. 두 원본은 그대로 보존합니다.';
  }
  if(businessPair&&(!workA||!workB)&&!['contact_move','separate'].includes(action)){
   action='defer';reasons.push('공종 미입력 — 같은 공사 여부 확인 필요');
  }
  return {key:pairKey(a,b),a,b,type,action,reasons,text,
   evidence:{businessPair,work:!businessPair?'not_applicable':!workA||!workB?'unknown':differentWork?'different':'same',construction:'unverified',registrationGapDays:days,
    addresses:[a,b].map(r=>({original:r.address||'',normalized:reviewAddress(r.address)}))}};
 }
 function candidates(rows){const out=[];for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){const c=classify(rows[i],rows[j]);if(c)out.push(c)}return out.sort((a,b)=>({inquiry:0,contact:1,deal:2,site:3}[a.type]-{inquiry:0,contact:1,deal:2,site:3}[b.type])||a.key.localeCompare(b.key))}
 function mergeIssue(c,action){
  const rows=[c.a,c.b],business=rows.filter(r=>['inquiry','deal'].includes(r.ref.type));
  if(action==='site_merge'&&business.length)return '현장 원본 통합으로 문의·영업건을 합칠 수 없습니다. 현장 연결 여부를 따로 확인해 주세요.';
  if(!['inquiry_merge','deal_review'].includes(action))return '';
  const works=business.map(r=>prep(r).work);
  if(business.length!==2||works.some(w=>!w))return '공종 미입력 — 공사 범위와 시기를 확인한 뒤 비교해 주세요.';
  if(works[0]!==works[1])return '공종이 달라 같은 공사로 합칠 근거가 부족합니다. 원본을 유지해 주세요.';
  return '';
 }
 const api={norm,blank,phone,similarity,pairKey,classify,candidates,mergeIssue};root.CleanupCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
