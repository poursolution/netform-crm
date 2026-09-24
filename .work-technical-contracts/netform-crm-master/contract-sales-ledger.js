/* Official CRM contract-sales policy. Construction lifecycle is deliberately absent. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ContractSalesLedger=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const POLICY='contract-signed-event-v1';
  function date(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';
    const n=Date.parse(value+'T00:00:00Z');
    return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===value?value:'';
  }
  function integer(value){return typeof value==='number'&&Number.isSafeInteger(value)}
  function required(ok,message){if(!ok)throw new Error(message)}
  function initial(input){
    required(input&&input.contract_signed===true,'CONTRACT_NOT_SIGNED');
    required(date(input.contract_date),'INVALID_CONTRACT_DATE');
    required(integer(input.contract_amount)&&input.contract_amount>0,'INVALID_CONTRACT_AMOUNT');
    required(typeof input.sales_owner==='string'&&input.sales_owner.trim(),'MISSING_SALES_OWNER');
    required(typeof input.deal_id==='string'&&input.deal_id.trim(),'MISSING_DEAL_ID');
    required(typeof input.event_id==='string'&&input.event_id.trim(),'MISSING_EVENT_ID');
    return {policy:POLICY,deal_id:input.deal_id,event_id:input.event_id,sequence:1,kind:'signed',effective_date:input.contract_date,amount_delta:input.contract_amount,sales_owner:input.sales_owner,sales_owner_name:String(input.sales_owner_name||''),reason:String(input.reason||'')};
  }
  // Validate a complete, ordered stream. Incomplete paginated streams are not totals.
  function validate(events){
    required(Array.isArray(events)&&events.length>0,'MISSING_CONTRACT_EVENTS');
    const rows=events.slice().sort((a,b)=>a.sequence-b.sequence),ids=new Set();
    let balance=0,cancelled=false;
    rows.forEach((e,i)=>{
      required(e.policy===POLICY&&e.sequence===i+1,'INVALID_EVENT_SEQUENCE');
      required(e.event_id&&!ids.has(e.event_id),'DUPLICATE_EVENT_ID');ids.add(e.event_id);
      required(e.deal_id&&e.deal_id===rows[0].deal_id,'CONTRACT_ID_CONFLICT');
      required(typeof e.sales_owner==='string'&&e.sales_owner.trim()&&e.sales_owner===rows[0].sales_owner,'SALES_OWNER_CONFLICT');
      required(date(e.effective_date)&&(!i||e.effective_date>=rows[i-1].effective_date),'INVALID_EVENT_DATE');
      required(integer(e.amount_delta),'INVALID_EVENT_AMOUNT');
      required(!cancelled,'CONTRACT_ALREADY_CANCELLED');
      if(!i)required(e.kind==='signed'&&e.amount_delta>0,'INVALID_SIGNING_EVENT');
      else{
        required(e.kind==='amended'||e.kind==='cancelled','INVALID_ADJUSTMENT_KIND');
        required(typeof e.reason==='string'&&e.reason.trim(),'MISSING_ADJUSTMENT_REASON');
        if(e.kind==='cancelled'){required(e.amount_delta===-balance,'INVALID_CANCELLATION_AMOUNT');cancelled=true}
        else required(e.amount_delta!==0&&balance+e.amount_delta>0,'INVALID_AMENDMENT_AMOUNT');
      }
      balance+=e.amount_delta;required(integer(balance),'AMOUNT_OVERFLOW');
    });
    return {events:rows,balance,cancelled,version:rows.length};
  }
  function append(events,input){
    const s=validate(events),first=s.events[0],last=s.events.at(-1);
    required(input.expected_version===s.version,'CONTRACT_VERSION_CONFLICT');
    const e={policy:POLICY,deal_id:first.deal_id,event_id:input.event_id,sequence:s.version+1,kind:input.kind,effective_date:input.effective_date,amount_delta:input.kind==='cancelled'?-s.balance:input.amount_delta,sales_owner:first.sales_owner,sales_owner_name:first.sales_owner_name,reason:input.reason};
    required(e.effective_date>=last.effective_date,'INVALID_EVENT_DATE');
    return validate(s.events.concat(e)).events;
  }
  function matches(e,f){
    return (!f.year||f.year==='전체'||e.effective_date.slice(0,4)===String(f.year))&&
      (!f.month||Number(e.effective_date.slice(5,7))===Number(f.month))&&
      (!f.quarter||Math.ceil(Number(e.effective_date.slice(5,7))/3)===Number(f.quarter))&&
      (!f.from||e.effective_date>=f.from)&&(!f.to||e.effective_date<=f.to)&&
      (!f.sales_owner||e.sales_owner===f.sales_owner);
  }
  function summarize(streams,filter){
    const f=filter||{},seen=new Set(),events=[],rows=new Map();
    (streams||[]).forEach(stream=>{
      const s=validate(stream),id=s.events[0].deal_id;
      required(!seen.has(id),'DUPLICATE_CONTRACT_STREAM');seen.add(id);
      s.events.filter(e=>matches(e,f)).forEach(e=>{
        let r=rows.get(e.sales_owner);
        if(!r){r={sales_owner:e.sales_owner,name:e.sales_owner_name,count:0,newAmount:0,amendmentAmount:0,cancellationAmount:0,netAmount:0,events:[]};rows.set(e.sales_owner,r)}
        if(e.kind==='signed'){r.count++;r.newAmount+=e.amount_delta}
        else if(e.kind==='amended')r.amendmentAmount+=e.amount_delta;
        else r.cancellationAmount+=e.amount_delta;
        r.netAmount+=e.amount_delta;r.events.push(e);events.push(e);
        required([r.newAmount,r.amendmentAmount,r.cancellationAmount,r.netAmount].every(integer),'AMOUNT_OVERFLOW');
      });
    });
    const result={policy:POLICY,basis:'계약 체결일 기준 · 변경·취소는 발생일 반영',rows:[...rows.values()],events,count:0,newAmount:0,amendmentAmount:0,cancellationAmount:0,netAmount:0};
    result.rows.forEach(r=>['count','newAmount','amendmentAmount','cancellationAmount','netAmount'].forEach(k=>{result[k]+=r[k];required(integer(result[k]),'AMOUNT_OVERFLOW')}));
    return result;
  }
  return {POLICY,date,initial,append,validate,summarize};
});
