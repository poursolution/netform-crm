'use strict';

const verdicts=Object.freeze({
  X01:Object.freeze({verdict:'NEEDS_VERIFICATION',mode:'SERVER_WRITE'}),
  X02:Object.freeze({verdict:'NEEDS_VERIFICATION',mode:'DIRECT_RPC'}),
  X03:Object.freeze({verdict:'NEEDS_VERIFICATION',mode:'ATOMIC_CONVERSION'}),
  A05:Object.freeze({verdict:'NEEDS_VERIFICATION',mode:'DIRECT_RPC'}),
  O01:Object.freeze({verdict:'NEEDS_VERIFICATION',mode:'SERVER_WRITE'}),
  O02:Object.freeze({verdict:'NEEDS_VERIFICATION',mode:'SERVER_WRITE'}),
  O03:Object.freeze({verdict:'CONFIRMED',mode:'LOCAL_ONLY'}),
  O04:Object.freeze({verdict:'NEEDS_VERIFICATION',mode:'DIRECT_RPC'}),
  O05:Object.freeze({verdict:'NEEDS_VERIFICATION',mode:'REACHABLE_MOCK'}),
  O06:Object.freeze({verdict:'NEEDS_VERIFICATION',mode:'REACHABLE_MOCK'})
});

function classify(id){
  if(!Object.prototype.hasOwnProperty.call(verdicts,id)) throw new Error('Unknown auxiliary operation');
  return verdicts[id];
}

/* Mirrors the currently reachable setYearGoal browser behavior. It is deliberately
   not a server command and must not be used as an organization-wide goal source. */
function normalizeAnnualGoalInput(raw,year){
  const y=Number(year);
  if(!Number.isInteger(y)||y<2000||y>9999) throw new Error('Invalid goal year');
  if(raw===null) return Object.freeze({cancelled:true,storage_key:`nf_year_goal_${y}`});
  const parsed=parseFloat(raw);
  const amount=Number.isNaN(parsed)?0:Math.round(parsed*1e8);
  return Object.freeze({cancelled:false,storage_key:`nf_year_goal_${y}`,amount});
}

module.exports=Object.freeze({
  verdicts,
  classify,
  normalizeAnnualGoalInput,
  connected_operations:Object.freeze([]),
  database_candidates:Object.freeze([])
});
