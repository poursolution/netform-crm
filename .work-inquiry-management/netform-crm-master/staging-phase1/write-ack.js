/* HTTP 200은 배달 확인일 뿐, 저장 완료 증거가 아닙니다. PC·모바일 공통 검사. */
(function(root){
 'use strict';
 function uncertain(message){const e=new Error('저장 확인 필요 · '+message);e.name='WriteAcknowledgementError';return e}
 function validate(raw,request={}){
  let value=raw;
  if(Array.isArray(value)){if(value.length!==1)throw uncertain('서버 응답 개수를 확인하지 못했습니다.');value=value[0]}
  // 최상위 실패를 내부 data.ok가 덮어쓰지 못하도록 먼저 검사합니다.
  if(value?.ok===false)throw uncertain('서버가 저장을 거부했습니다.');
  if(value?.data&&typeof value.data==='object')value=value.data;
  if(!value||value.ok!==true)throw uncertain('명시적인 저장 성공 응답이 없습니다.');
  if(value.write_id&&value.write_id!==request.write_id)throw uncertain('요청과 응답의 식별자가 다릅니다.');
  if(value.operation&&request.op&&value.operation!==request.op)throw uncertain('다른 작업의 응답입니다.');
  if(['opportunity_create','lead_create'].includes(request.op)&&!value.new_opportunity_id)throw uncertain('생성된 영업기회 ID가 없습니다.');
  return value;
 }
 async function read(response,request){
  // 네트워크/서버 오류도 이미 저장됐을 가능성이 있으므로 자동 재전송하지 않습니다.
  if(!response.ok)throw uncertain('HTTP '+response.status+' · 처리 결과를 확인한 뒤 재시도하세요.');
  let raw;try{raw=await response.json()}catch(e){throw uncertain('응답을 읽을 수 없습니다. 완료로 표시하지 않았습니다.')}
  return validate(raw,request);
 }
 const api={validate,read};root.WriteAck=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
