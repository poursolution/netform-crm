(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SalesInsightsModel=api;
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 // Receives only the already-authorized CRM bundle, normalized by the UI adapter.
 const finite=n=>Number.isFinite(Number(n))?Number(n):0;
 function date(value){
  if(!value)return '';
  const text=String(value);
  if(/^\d{4}-\d{2}-\d{2}$/.test(text))return Number.isFinite(Date.parse(text))?text:'';
  const stamp=Date.parse(text);if(!Number.isFinite(stamp))return '';
  return new Date(stamp+9*3600000).toISOString().slice(0,10);
 }
 function inPeriod(value,f){const d=date(value);return !!d&&(!f.year||f.year==='전체'||d.slice(0,4)===String(f.year))&&(!f.month||Number(d.slice(5,7))===Number(f.month))}
 function unique(rows){const seen=new Set();return rows.filter(r=>{if(seen.has(r.key))return false;seen.add(r.key);return true})}
 function scope(rows,f){return unique(rows).filter(r=>(!f.brand||f.brand==='전체'||r.brand===f.brand)&&(!f.owner||f.owner==='전체'||r.owner===f.owner))}
 function summarize(deals,inquiries,f){
  const D=scope(deals,f),Q=scope(inquiries,f).filter(q=>inPeriod(q.created,f));
  const active=D.filter(d=>d.active),won=D.filter(d=>d.won&&inPeriod(d.wonAt,f)),risk=active.filter(d=>d.issues.length);
  const sum=(rows,key)=>rows.reduce((n,r)=>n+finite(r[key]),0);
  const trend=Array.from({length:12},(_,i)=>({month:i+1,amount:0,count:0,missing:0}));
  won.forEach(d=>{const x=trend[Number(date(d.wonAt).slice(5,7))-1];if(x){x.count++;x.amount+=finite(d.wonAmount);if(!d.hasWonAmount)x.missing++}});
  const stages=[];active.forEach(d=>{let x=stages.find(x=>x.code===d.stage);if(!x){x={code:d.stage,label:d.stageLabel,count:0};stages.push(x)}x.count++});
  const order=['first_contact','rapport','silent','waiting','consulting','sent','compete','imminent','bidding','contract','construction','completion'];
  stages.sort((a,b)=>(order.includes(a.code)?order.indexOf(a.code):999)-(order.includes(b.code)?order.indexOf(b.code):999)||a.label.localeCompare(b.label));
  return {deals:D,inquiries:Q,active,won,risk,expected:sum(active,'expected'),wonAmount:sum(won,'wonAmount'),missingWon:won.filter(d=>!d.hasWonAmount).length,missingWonDate:D.filter(d=>d.won&&!date(d.wonAt)).length,trend,stages};
 }
 function select(summary,kind,filters){
  const pools={inquiries:summary.inquiries,active:summary.active,won:summary.won,risk:summary.risk};
  let rows=(pools[kind]||summary.risk).slice(),f=filters||{},q=String(f.search||'').toLocaleLowerCase();
  return rows.filter(r=>(!f.issue||f.issue==='all'||(f.issue==='urgent'?r.issues.includes('overdue'):r.issues.includes(f.issue)))&&(!f.stage||f.stage==='all'||r.stage===f.stage)&&(!q||[r.site,r.owner,r.stageLabel,r.reason].join(' ').toLocaleLowerCase().includes(q)))
   .sort((a,b)=>Number(b.issues.includes('overdue'))-Number(a.issues.includes('overdue'))||Number(b.issues.includes('missing'))-Number(a.issues.includes('missing'))||String(a.key).localeCompare(String(b.key)));
 }
 return {date,inPeriod,scope,summarize,select};
});
