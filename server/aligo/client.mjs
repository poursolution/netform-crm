// Server-only Aligo SMS adapter. Never import this module into a browser bundle.
const BASE='https://apis.aligo.in/';
export class AligoError extends Error {
  constructor(code, ambiguous=false) { super(code); this.name='AligoError'; this.code=code; this.ambiguous=ambiguous; }
}
const digits=value=>String(value??'').replace(/[-\s]/g,'');
function phone(value) {
  const p=digits(value);
  if(!/^0\d{8,10}$/.test(p)) throw new AligoError('INVALID_PHONE');
  return p;
}
function id(value) {
  if(typeof value!=='string'&&typeof value!=='number') throw new AligoError('INVALID_MESSAGE_ID');
  const s=String(value);
  if(!/^[1-9]\d{0,19}$/.test(s)||typeof value==='number'&&!Number.isSafeInteger(value)) throw new AligoError('INVALID_MESSAGE_ID');
  return s;
}
function integer(value) { return /^(0|[1-9]\d*)$/.test(String(value)) ? Number(value) : NaN; }
export function aligoSchedule(value,now=Date.now()) {
  if(typeof value!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(value)) throw new AligoError('SCHEDULE_TIMEZONE_REQUIRED');
  const ms=Date.parse(value);
  // Aligo accepts minute precision; round up so we never schedule before the requested instant.
  const rounded=Math.ceil(ms/60000)*60000;
  if(!Number.isFinite(ms)||ms-now<600000) throw new AligoError('SCHEDULE_AT_LEAST_TEN_MINUTES');
  const iso=new Date(rounded+9*3600000).toISOString();
  return {rdate:iso.slice(0,10).replaceAll('-',''),rtime:iso.slice(11,16).replace(':','')};
}
export function createAligoClient({key,userId,sender,fetchImpl=fetch,timeoutMs=15000,now=()=>Date.now()}) {
  if(typeof key!=='string'||!key.trim()||typeof userId!=='string'||!userId.trim()) throw new AligoError('ALIGO_CREDENTIALS_REQUIRED');
  const from=phone(sender);
  async function post(route,fields,isSend=false) {
    const body=new URLSearchParams({key,user_id:userId,...fields});
    let result;
    try {
      const response=await fetchImpl(BASE+route+'/',{
        method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body,signal:AbortSignal.timeout(timeoutMs),redirect:'error'
      });
      if(!response.ok) throw new Error('HTTP failure');
      result=await response.json();
      if(!result||typeof result!=='object'||Array.isArray(result)) throw new Error('invalid response');
    } catch {
      // A timeout/HTTP/parse failure after send is not proof of rejection. Never retry automatically.
      throw new AligoError(isSend?'ALIGO_SEND_OUTCOME_UNKNOWN':'ALIGO_QUERY_FAILED',isSend);
    }
    const code=Number(result.result_code);
    if(!Number.isInteger(code)||code!==1) {
      if(Number.isInteger(code)&&code<0) throw new AligoError('ALIGO_REJECTED_'+code);
      throw new AligoError(isSend?'ALIGO_SEND_OUTCOME_UNKNOWN':'ALIGO_QUERY_FAILED',isSend);
    }
    return result;
  }
  return Object.freeze({
    identity:'aligo:'+userId+':'+from,
    async balance() {
      const r=await post('remain',{});
      const counts={sms:integer(r.SMS_CNT),lms:integer(r.LMS_CNT),mms:integer(r.MMS_CNT)};
      if(Object.values(counts).some(n=>!Number.isSafeInteger(n)||n<0)) throw new AligoError('ALIGO_INVALID_BALANCE');
      return counts;
    },
    async send({receiver,message,type='SMS',mode='test',scheduledAt}) {
      if(!['test','live'].includes(mode)||!['SMS','LMS'].includes(type)) throw new AligoError('INVALID_SEND_MODE');
      if(typeof message!=='string'||!message.trim()||message.length>2000) throw new AligoError('INVALID_MESSAGE');
      // UTF-8 is a conservative upper bound for ordinary Korean text; Aligo ultimately validates EUC-KR.
      const bytes=new TextEncoder().encode(message).length;
      if(bytes>(type==='SMS'?90:2000)) throw new AligoError('MESSAGE_TOO_LONG');
      const fields={sender:from,receiver:phone(receiver),msg:message,msg_type:type,testmode_yn:mode==='test'?'Y':'N'};
      if(scheduledAt) Object.assign(fields,aligoSchedule(scheduledAt,now()));
      const r=await post('send',fields,true);
      let messageId;
      try { messageId=id(r.msg_id); } catch { throw new AligoError('ALIGO_SEND_OUTCOME_UNKNOWN',true); }
      if(integer(r.success_cnt)!==1||integer(r.error_cnt)!==0) throw new AligoError('ALIGO_SEND_OUTCOME_UNKNOWN',true);
      return {provider:'aligo',messageId,status:mode==='test'?'test_accepted':'submitted',mode};
    },
    async delivery({messageId,receiver}) {
      const mid=id(messageId),to=phone(receiver);
      const r=await post('sms_list',{mid,page:'1',page_size:'30'});
      if(!Array.isArray(r.list)) throw new AligoError('ALIGO_INVALID_DELIVERY');
      const matches=r.list.filter(row=>digits(row.receiver)===to&&digits(row.sender)===from);
      // Every request from this adapter has one recipient. Never select a mismatched/ambiguous row.
      if(matches.length!==1||r.next_yn==='Y') return {provider:'aligo',messageId:mid,status:'submitted',needsReview:true};
      const row=matches[0],state=String(row.sms_state??'');
      const failed=new Set(['가입자없음','결번','전송실패','발송실패','수신거부','취소완료']);
      return {provider:'aligo',messageId:mid,detailId:id(row.mdid),
        status:state==='발송완료'?'sent':failed.has(state)?'failed':'submitted',
        needsReview:state!=='발송완료'&&!failed.has(state)&&!['전송중','발송중','예약대기중'].includes(state)};
    }
  });
}
