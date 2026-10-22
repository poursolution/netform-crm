/* 브랜드별 발신번호 (2026-10-22 회의록 9/9 '공식 브랜드 채널 발신 분리')
   실행기 설정(credentials.dpapi)의 senders = { "POUR공법":"0212345678", "아파트스퀘어":"0312345678", … } 를
   브랜드 → (알리고 클라이언트 · 로컬 원장) 묶음으로 만든다. 큐 항목의 sender_brand 가 없거나 번호가 안 정해진 브랜드는 기본 발신번호(config.sender).
   알리고에 미리 등록된 발신번호만 실제로 통한다(등록은 알리고 관리 화면에서 — 여기서는 번호 모양만 본다). */
export const KNOWN_BRANDS=Object.freeze(['POUR공법','아파트스퀘어','석민이앤씨','POUR솔루션']);
const DIGITS=/^0\d{8,10}$/;
export function normalizeSenders(input){
 const out={};if(!input||typeof input!=='object')return out;
 for(const [brand,value] of Object.entries(input)){
  const b=String(brand||'').trim(),n=String(value??'').replace(/[-\s]/g,'');
  if(!b||b.length>60||!n)continue;
  if(!DIGITS.test(n))throw Object.assign(Error('INVALID_SENDER_NUMBER'),{code:'INVALID_SENDER_NUMBER',brand:b});
  out[b]=n;
 }
 return out;
}
export function senderLanes({config,createClient,createDispatcher}){
 if(!config||typeof config!=='object')throw Object.assign(Error('ALIGO_CREDENTIALS_REQUIRED'),{code:'ALIGO_CREDENTIALS_REQUIRED'});
 const senders=normalizeSenders(config.senders),byNumber=new Map();
 const lane=number=>{const key=String(number).replace(/[-\s]/g,'');if(!byNumber.has(key)){const provider=createClient({...config,sender:key});byNumber.set(key,{provider,dispatcher:createDispatcher(provider),sender:key});}return byNumber.get(key);};
 const base=lane(config.sender);
 for(const n of Object.values(senders))lane(n);
 return Object.freeze({
  default:base,brands:Object.freeze({...senders}),
  for(brand){const b=String(brand||'').trim();const n=b&&senders[b];return n?lane(n):base;},
  lanes:()=>[...byNumber.values()],
  close(){for(const l of byNumber.values()){try{l.dispatcher.close();}catch{}}}
 });
}
