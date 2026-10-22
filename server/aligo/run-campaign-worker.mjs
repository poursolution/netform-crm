import {join} from 'node:path';
import {existsSync,writeFileSync,readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {unprotectConfig} from './windows-credentials.mjs';
import {createAligoClient} from './client.mjs';
import {AligoDispatcher} from './dispatcher.mjs';
import {CampaignWorker,createQueueClient} from './campaign-worker.mjs';
import {InquiryReplyWorker} from './inquiry-reply-worker.mjs';
import {senderLanes} from './sender-lanes.mjs';
const root=join(process.env.LOCALAPPDATA||'','netform-crm','aligo');
let lanes;
try {
 if(process.platform!=='win32'||process.env.ALIGO_CAMPAIGN_ENABLED!=='true')throw Error('CAMPAIGN_WORKER_DISABLED');
 const config=unprotectConfig(join(root,'credentials.dpapi'));
 const backend=unprotectConfig(join(root,'crm-backend.dpapi'));
 const identity=join(root,'worker-id.txt');
 if(!existsSync(identity))writeFileSync(identity,randomUUID(),{flag:'wx',mode:0o600});
 /* 브랜드별 발신번호(2026-10-22): config.senders = {브랜드: 번호}. 큐 항목의 sender_brand 로 고르고, 없으면 기본 발신번호(config.sender). 원장 파일은 하나(요청 번호는 전체에서 유일) */
 const ledger=join(root,'campaign-dispatch.sqlite');
 lanes=senderLanes({config,createClient:createAligoClient,createDispatcher:p=>new AligoDispatcher(ledger,p)});
 const {provider,dispatcher}=lanes.default;
 const queue=createQueueClient(backend),workerId=readFileSync(identity,'utf8').trim();
 const worker=new CampaignWorker({provider,dispatcher,workerId,queue,allowedReceivers:[config.receiver],liveEnabled:true,lanes});
 // 견적문의 응대 문자(2026-10-03): 담당자가 CRM 상세 창에서 요청한 문자 — 받는 번호는 서버가 문의의 010 번호로만 채운다
 const replies=process.env.ALIGO_INQUIRY_REPLIES==='true'?new InquiryReplyWorker({provider,dispatcher,workerId,queue,enabled:true,lanes}):null;
 console.log(JSON.stringify({senders:Object.keys(lanes.brands),lanes:lanes.lanes().length}));
 let stopping=false;process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
 do {
  const result=await worker.tick();
  const reply=replies?await replies.tick():null;
  console.log(JSON.stringify({at:new Date().toISOString(),pending:result.pending.length,claimed:result.claimed.length,inquiry:reply?{pending:reply.pending.length,claimed:reply.claimed.length}:'off'}));
  if(process.argv.includes('--once')||stopping)break;
  await delay(15000);
 }while(!stopping);
}catch(e){
 // Do not include raw network/credential errors in logs.
 console.error(e?.code||'CAMPAIGN_WORKER_STOPPED');process.exitCode=1;
}finally{dispatcher?.close();}
