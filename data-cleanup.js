/* Non-destructive duplicate classification. Also consumed by node:test. */
(function(root){
 'use strict';
 const norm=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[\s·.,()\[\]_-]/g,'');
 const name=v=>norm(v).replace(/아파트/g,'');
 const phone=v=>String(v||'').replace(/\D/g,'');
 const same=(a,b)=>!!a&&!!b&&a===b;
 function similarity(a,b){a=name(a);b=name(b);if(!a||!b)return 0;if(a===b)return 1;if(Math.min(a.length,b.length)<4)return 0;const grams=s=>new Set(Array.from({length:s.length-1},(_,i)=>s.slice(i,i+2))),x=grams(a),y=grams(b);return 2*[...x].filter(v=>y.has(v)).length/(x.size+y.size)}
 function pairKey(a,b){return [a.ref.type+':'+a.ref.id,b.ref.type+':'+b.ref.id].sort().join('|')}
 function classify(a,b){
  if(a.ref.type===b.ref.type&&String(a.ref.id)===String(b.ref.id))return null;
  if(a.ref.type==='organization'&&String(a.ref.id)===b.siteId||b.ref.type==='organization'&&String(b.ref.id)===a.siteId)return null;
  if(a.ref.type==='inquiry'&&b.ref.type==='deal'&&(a.linkedDealId===b.ref.id||b.originInquiryId===a.ref.id)||b.ref.type==='inquiry'&&a.ref.type==='deal'&&(b.linkedDealId===a.ref.id||a.originInquiryId===b.ref.id))return null;
  const address=same(norm(a.address),norm(b.address)),conflict=!!norm(a.address)&&!!norm(b.address)&&!address;
  const mobile=same(phone(a.mobile),phone(b.mobile))&&/^01\d{8,9}$/.test(phone(a.mobile));
  const office=same(phone(a.office),phone(b.office))&&phone(a.office).length>=9;
  const siteId=same(a.siteId,b.siteId),names=similarity(a.name,b.name),sameSite=siteId||address;
  const workA=[...new Set(a.works||[])].sort().join('|'),workB=[...new Set(b.works||[])].sort().join('|');
  const differentWork=!!workA&&!!workB&&workA!==workB,differentBiz=!!a.brand&&!!b.brand&&a.brand!==b.brand;
  const da=Date.parse(a.at),db=Date.parse(b.at),days=Number.isFinite(da)&&Number.isFinite(db)?Math.abs(da-db)/864e5:null;
  const reasons=[];if(address)reasons.push('주소 동일');if(office)reasons.push('관리사무소 전화 동일');if(siteId)reasons.push('현장 ID 동일');if(names===1)reasons.push('현장명 표기 일치');else if(names>=.72)reasons.push('현장명 유사 — 확인 필요');if(conflict)reasons.push('등록 주소 서로 다름');
  let type,action,text;
  if(mobile&&!siteId&&(conflict||names<.72)){
   type='contact';action='contact_move';reasons.push('관리소장 휴대전화 동일');text='관리소장 이동 또는 공용 연락처일 수 있습니다. 사람과 근무지만 확인하고 현장은 합치지 마세요.';
  }else if(conflict&&!siteId&&names>=.72){type='site';action='separate';text='주소가 다릅니다. 단지·동 구분을 확인하고 별도 현장으로 유지하세요.';
  }else if(a.ref.type==='inquiry'&&b.ref.type==='inquiry'&&(sameSite||names===1)&&(office||mobile||address)&&!differentWork&&!differentBiz&&days!==null&&days<=1){
   type='inquiry';action='inquiry_merge';reasons.push('1일 이내 문의 접수');text='같은 요청의 중복 접수인지 비교하세요. 추가 정보라면 원본 문의를 활동으로 연결할 수 있습니다.';
  }else if(a.ref.type==='deal'&&b.ref.type==='deal'&&(sameSite||names===1)&&!conflict&&!differentWork&&!differentBiz&&workA&&workA===workB&&days!==null&&days<=30){
   type='deal';action='deal_review';reasons.push('동일 공종 · 30일 이내 등록');text='영업기회 중복 가능성입니다. 계약·수주·활동 이력을 비교한 뒤 판단하세요. 자동 병합하지 않습니다.';
  }else if((sameSite||names===1)&&!conflict&&(differentWork||differentBiz||(days!==null&&days>365))){
   type='site';action='site_link';reasons.push(differentWork?'공종 서로 다름':differentBiz?'사업유형 서로 다름':'영업 시기 서로 다름');text='정상적인 복수 영업입니다. 하나의 현장으로 연결하고 영업기회는 각각 유지하세요.';
  }else if(!conflict&&(address||office&&names>=.72||names>=.82)){
   type='site';action=address||office?'site_merge':'defer';text=address||office?'현장 Master 통합 후보입니다. 이름·주소를 확인하고 개별 영업기회와 이력은 유지하세요.':'이름만으로 확정할 수 없습니다. 주소와 관리사무소 정보를 보완한 뒤 검토하세요.';
  }else return null;
  return {key:pairKey(a,b),a,b,type,action,reasons,text};
 }
 function candidates(rows){const out=[];for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){const c=classify(rows[i],rows[j]);if(c)out.push(c)}return out.sort((a,b)=>({inquiry:0,contact:1,deal:2,site:3}[a.type]-{inquiry:0,contact:1,deal:2,site:3}[b.type])||a.key.localeCompare(b.key))}
 const api={norm,phone,similarity,pairKey,classify,candidates};root.CleanupCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
