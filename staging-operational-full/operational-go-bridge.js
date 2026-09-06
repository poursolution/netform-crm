/* Golden UI compatibility bridge for the final operational candidate. */
(function(root){
 'use strict';
 if(typeof root.pushWrite!=='function')throw Error('OPERATIONAL_GO_BRIDGE_LOAD_ORDER');
 const base=root.pushWrite;
 root.pushWrite=function(operation,payload){
  if(operation==='handover')return 'absorbed:handover';
  if(operation==='inquiry_assign'&&payload&&payload.response===undefined){
   const branch=payload.to==='경남지사'||payload.branch_code==='gyeongnam'||payload.assignment_group==='gyeongnam'||payload.owner_group==='gyeongnam';
   if(branch&&!payload.intent){
    const mode=root.INQ_CTL_MODAL&&root.INQ_CTL_MODAL.mode;
    const intent=payload.to==='경남지사'?(mode==='branch_owner'?'branch_owner_pool':'branch_handoff'):'branch_owner_assign';
    payload=Object.assign({},payload,{intent:intent});
   }
  }
  return base(operation,payload);
 };
})(window);
