/* Local connection candidate. No automatic installation, network access or production writes. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.RelationshipContactCandidate=factory();})(typeof globalThis==='undefined'?this:globalThis,function(){
 'use strict';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 function fail(code){const e=new Error(code);e.code=code;throw e;}
 function only(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))fail('INVALID_PAYLOAD');}
 function text(value,min,max){if(typeof value!=='string'||value.trim().length<min||value.length>max)fail('INVALID_TEXT');return value.trim();}
 function id(value){if(typeof value!=='string'||!UUID.test(value))fail('INVALID_ID');return value.toLowerCase();}
 function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail('INVALID_DATE');return value;}
 function freeze(value){Object.values(value).forEach(v=>{if(v&&typeof v==='object')freeze(v)});return Object.freeze(value);}
 function normalize(input){
  only(input,['object_id','expected_version','activity','next_action']);
  if(!Number.isSafeInteger(input.expected_version)||input.expected_version<0||input.expected_version>2147483645)fail('INVALID_VERSION');
  only(input.activity,['type','note','result','occurred_at','meaningful_contact']);only(input.next_action,['type','text','due_at']);
  const a=input.activity,n=input.next_action;
  if(typeof a.meaningful_contact!=='boolean')fail('CONTACT_OUTCOME_REQUIRED');
  // Require an explicit timezone so local settings cannot silently move the contact date.
  if(typeof a.occurred_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(a.occurred_at)||!Number.isFinite(Date.parse(a.occurred_at)))fail('INVALID_OCCURRED_AT');
  date(a.occurred_at.slice(0,10));
  const occurred_at=new Date(a.occurred_at).toISOString(),due_at=date(n.due_at);
  const contactDate=new Date(Date.parse(occurred_at)+9*60*60*1000).toISOString().slice(0,10);
  if(due_at<contactDate)fail('NEXT_DATE_BEFORE_CONTACT');
  return freeze({operation:'relationship_contact',object_id:id(input.object_id),expected_version:input.expected_version,payload:{
   activity:{type:text(a.type,1,100),note:text(a.note,1,4000),result:a.result==null?'':text(a.result,0,8000),occurred_at,meaningful_contact:a.meaningful_contact},
   next_action:{type:text(n.type,1,100),text:text(n.text,1,500),due_at}
  }});
 }
 function validateAck(command,ack,actor){
  if(!ack||ack.ok!==true||ack.contract_version!==1||ack.operation!==command.operation||ack.request_id!==command.request_id||ack.object_id!==command.object_id||ack.previous_version!==command.expected_version||ack.version!==command.expected_version+2||typeof ack.replayed!=='boolean'||ack.actor_auth_uid!==actor.auth_uid||ack.actor_user_id!==actor.user_id)fail('ACK_CONTRACT_MISMATCH');
  for(const k of ['activity_id','next_action_id','activity_request_id','next_request_id'])if(typeof ack[k]!=='string'||!UUID.test(ack[k]))fail('ACK_CONTRACT_MISMATCH');
  if(ack.activity_request_id===ack.next_request_id)fail('ACK_CONTRACT_MISMATCH');
  return freeze(JSON.parse(JSON.stringify(ack)));
 }
 function createController(options){
  const actor=freeze({auth_uid:id(options.actor.auth_uid),user_id:id(options.actor.user_id)});
  if(typeof options.send!=='function'||typeof options.uuid!=='function')fail('TRANSPORT_REQUIRED');
  let pending=null,running=null,current=Object.freeze({phase:'idle',error:null});
  function set(phase,error){current=Object.freeze({phase,error:error||null});}
  function dispatch(){
   set('saving');const command=pending.command;
   // No optimistic object mutation. Only the caller of a validated ACK may refresh/apply data.
   running=Promise.resolve().then(()=>options.send(command)).then(raw=>{
    const ack=validateAck(command,raw,actor);set('saved');pending=null;return ack;
   }).catch(error=>{
    const code=error&&error.code||'TRANSPORT_UNCERTAIN';
    // SQL validation/authorization/conflict errors roll back; transport and malformed ACKs may have committed.
    if(['22023','42501','PT409'].includes(code)){set('rejected',code);pending=null;}
    else set('uncertain',code);
    throw error;
   }).finally(()=>{running=null;});
   return running;
  }
  return Object.freeze({
   state:()=>current,
   save(input){const normalized=normalize(input),key=JSON.stringify(normalized);
    if(running){if(pending.key===key)return running;fail('SAVE_IN_PROGRESS');}
    if(pending)fail('PREVIOUS_RESULT_UNCERTAIN');
    pending={key,command:freeze({...normalized,request_id:id(options.uuid())})};return dispatch();
   },
   retry(){if(running)return running;if(!pending||current.phase!=='uncertain')fail('NO_UNCERTAIN_REQUEST');return dispatch();}
  });
 }
 function extendAdapter(base){
  // Opt-in only: the installed Production adapter and transport are not mutated.
  return Object.freeze({
   operations:Object.freeze([...new Set([...base.operations,'relationship_contact'])]),
   normalize(operation,objectId,expectedVersion,payload){
    if(operation!=='relationship_contact')return base.normalize(operation,objectId,expectedVersion,payload);
    only(payload,['activity','next_action']);
    return normalize({object_id:objectId,expected_version:expectedVersion,...payload});
   },
   validateAck(ack,command){
    if(command.operation!=='relationship_contact')return base.validateAck(ack,command);
    return validateAck(command,ack,{auth_uid:command.auth_uid,user_id:command.user_id});
   }
  });
 }
 return Object.freeze({normalize,validateAck,createController,extendAdapter});
});
