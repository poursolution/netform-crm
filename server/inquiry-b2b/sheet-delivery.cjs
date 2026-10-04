'use strict';
// Pure data transformation. Existing Google credential performs targeted reads/writes in n8n.
function plan(claim, response) {
 const e=claim.event, token=claim.token;
 const review=reason=>({action:'review',event_id:e.event_id,token,reason});
 const ranges=response.valueRanges||[],headers=ranges[0]?.values?.[0]||[],row=ranges[1]?.values?.[0]||[];
 const required=['고객연락처','브랜드','문의내용','진행상태','응대내용','다음액션일','종료사유'];
 if(required.some(k=>headers.filter(h=>h===k).length!==1))return review('SHEET_HEADERS_REVIEW');
 const get=k=>String(row[headers.indexOf(k)]??''),phone=v=>String(v||'').replace(/\D/g,''),text=v=>String(v||'').replace(/\r\n/g,'\n').trim();
 if(!Number.isInteger(e.sheet_row)||e.sheet_row<2||e.sheet_row>=1000000||phone(get('고객연락처'))!==phone(e.phone)||get('브랜드')!==e.brand||!text(e.source_inquiry)||text(get('문의내용'))!==text(e.source_inquiry))return review('SHEET_IDENTITY_REVIEW');
 const results=['협약완료','해결완료','종결'],marker='[CRM B2B '+e.event_id+']';
 if(!results.includes(e.result)||typeof e.note!=='string'||!Number.isFinite(Date.parse(e.completed_at)))return review('SHEET_STATE_REVIEW');
 const old=get('진행상태'),notes=get('응대내용');
 if(notes.includes(marker)) {
  if(old===e.result&&get('다음액션일')===''&&get('종료사유')===e.result+(e.note?' · '+e.note:''))return {action:'ack',event_id:e.event_id,token};
  return review('SHEET_STATE_REVIEW');
 }
 if(['수주','실주','배드핏','종료','연락두절','영업전환',...results].includes(old))return review('SHEET_STATE_REVIEW');
 const col=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
 const line=marker+' '+e.completed_at+' '+e.result+(e.note?' · '+e.note:'');
 const values={'진행상태':e.result,'응대내용':notes?notes+'\n'+line:line,'다음액션일':'','종료사유':e.result+(e.note?' · '+e.note:'')};
 return {action:'write',event_id:e.event_id,token,body:{valueInputOption:'RAW',includeValuesInResponse:true,data:Object.entries(values).map(([k,v])=>({range:"'시트1'!"+col(headers.indexOf(k))+e.sheet_row,majorDimension:'ROWS',values:[[v]]}))}};
}
function verifyWrite(plan,response){return !!(response.totalUpdatedCells===4&&Array.isArray(response.responses)&&response.responses.length===4&&response.responses.every((r,n)=>r.updatedData?.values?.[0]?.[0]===plan.body.data[n].values[0][0] || plan.body.data[n].values[0][0]==='' && (!r.updatedData?.values?.length)));}
module.exports={plan,verifyWrite};
