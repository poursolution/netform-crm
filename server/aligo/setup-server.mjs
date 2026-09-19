import http from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createAligoClient,AligoError} from './client.mjs';
import {AligoDispatcher} from './dispatcher.mjs';
import {protectConfig,unprotectConfig} from './windows-credentials.mjs';
import {connectBackend,checkBackend} from './backend-connection.mjs';

const root=process.env.ALIGO_PRIVATE_DIR||join(process.env.LOCALAPPDATA||'','netform-crm','aligo');
if(process.platform!=='win32'||!process.env.LOCALAPPDATA) throw Error('Windows user profile required');
mkdirSync(root,{recursive:true,mode:0o700});
const port=Number(process.env.ALIGO_SETUP_PORT||45873),origin='http://127.0.0.1:'+port;
const csrf=randomBytes(32).toString('hex'),profile=join(root,'credentials.dpapi'),jobPath=join(root,'test-job.json');
const backendProfile=join(root,'crm-backend.dpapi');
let config=existsSync(profile)?unprotectConfig(profile):null;
let notice='',result=null,busy=false;
const h=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function persistResult(r){result=r;writeFileSync(join(root,'last-result.json'),JSON.stringify({at:new Date().toISOString(),...r},null,2),{mode:0o600});}
function form(action,title){return '<form method="post" action="'+action+'"><input type="hidden" name="csrf" value="'+csrf+'"><button>'+title+'</button></form>';}
function page(){
 return '<!doctype html><html lang="ko"><meta charset="utf-8"><title>영업운영 CRM · 알리고 연결</title><style>body{font:16px system-ui;max-width:760px;margin:40px auto;padding:20px;color:#14243a}label{display:block;margin:12px 0}input{display:block;width:95%;padding:10px}button{padding:12px;margin:8px 0;background:#173a70;color:white;border:0;border-radius:6px}pre{white-space:pre-wrap;background:#f1f5fa;padding:18px}</style><h1>영업운영 CRM · 알리고 연결</h1><p>이 컴퓨터 전용 설정입니다. 인증키는 Windows 사용자 암호화 저장소에 보관됩니다.</p>'
 +(config?'<p>계정: '+h(config.userId)+' · 발신번호: '+h(config.sender)+' · 테스트 수신번호: '+h(config.receiver)+'</p>':'<form method="post" action="/connect"><input type="hidden" name="csrf" value="'+csrf+'"><label>알리고 사용자 ID<input name="userId" autocomplete="off" required></label><label>알리고 API 키<input name="key" type="password" autocomplete="off" required></label><label>발신번호<input name="sender" required></label><label>테스트 수신번호<input name="receiver" required></label><button>인증 확인 및 암호화 저장</button></form>')
 +(config?form('/balance','API 연결 확인')+form('/dry-run','과금 없는 연동 시험')+form('/send','테스트 문자 1건 발송')+form('/status','실제 전송 결과 조회'):'')
 +(config?'<h2>CRM 서버 연결</h2><p>영업운영 CRM 전용입니다. 연결 확인은 조회만 수행하며 자동발송을 시작하지 않습니다.</p>'+(existsSync(backendProfile)?form('/backend-check','저장된 서버 연결 확인'):'<form method="post" action="/backend-connect"><input type="hidden" name="csrf" value="'+csrf+'"><label>CRM 서버 키<input name="backendKey" type="password" autocomplete="off" required></label><button>서버 인증 확인 및 암호화 저장</button></form>'):'')
 +'<p role="status">'+h(notice)+'</p>'+(result?'<pre>'+h(JSON.stringify(result,null,2))+'</pre>':'')+'<p>같은 테스트 요청은 반복 클릭해도 다시 발송하지 않습니다.</p></html>';
}
async function body(req){
 let value='';for await(const chunk of req){value+=chunk;if(value.length>8192)throw Error('request too large');}
 return new URLSearchParams(value);
}
function job(){
 if(existsSync(jobPath)) {
  const saved=JSON.parse(readFileSync(jobPath,'utf8'));
  if(saved.receiver!==config.receiver||saved.sender!==config.sender||saved.userId!==config.userId) throw Error('Saved test identity differs');
  return saved;
 }
 const value={requestId:randomUUID(),dryRequestId:randomUUID(),userId:config.userId,sender:config.sender,receiver:config.receiver,message:'[넷폼 CRM] 알리고 연결 테스트입니다.',type:'SMS',mode:'live'};
 writeFileSync(jobPath,JSON.stringify(value),{mode:0o600});return value;
}
const server=http.createServer(async(req,res)=>{
 const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"};
 const reply=(status,text)=>{res.writeHead(status,headers);res.end(text);};
 if(req.headers.host!=='127.0.0.1:'+port) return reply(403,'Forbidden host');
 if(req.method==='GET'&&['/','/status'].includes(req.url)) return reply(200,page());
 if(req.method!=='POST'||req.headers.origin!==origin) return reply(403,'Forbidden origin');
 try{
  const p=await body(req);
  if(p.get('csrf')!==csrf) return reply(403,'Invalid session');
  if(busy) return reply(409,'작업이 진행 중입니다.');
  busy=true;
  try{
   if(req.url==='/connect'){
    if(config) throw Error('Already configured');
    const candidate={key:p.get('key'),userId:p.get('userId'),sender:p.get('sender'),receiver:p.get('receiver')};
    if(!/^01\d{8,9}$/.test(candidate.receiver||'')) throw Error('Invalid recipient');
    const balance=await createAligoClient(candidate).balance();
    protectConfig(profile,candidate);config=candidate;
    persistResult({operation:'connect',ok:true,balance});notice='알리고 API 인증과 암호화 저장이 완료됐습니다.';
   }else{
    if(!config) throw Error('Not configured');
    const client=createAligoClient(config);
    if(req.url==='/backend-connect'){
     const checked=await connectBackend(p.get('backendKey'),{path:backendProfile,protect:protectConfig,unprotect:unprotectConfig,exists:existsSync});
     persistResult(checked);notice='CRM 서버 인증과 암호화 저장 완료. 자동발송은 꺼져 있습니다.';
    }else if(req.url==='/backend-check'){
     persistResult(await checkBackend(unprotectConfig(backendProfile)));notice='저장된 CRM 서버 인증으로 조회 성공. 자동발송은 꺼져 있습니다.';
    }else
    if(req.url==='/balance'){persistResult({operation:'balance',ok:true,balance:await client.balance()});notice='API 연결 정상';}
    else if(['/dry-run','/send','/status'].includes(req.url)){
     const value=job(),dispatch=new AligoDispatcher(join(root,'aligo-dispatch.sqlite'),client);
     try{
      const dry=req.url==='/dry-run';
      const request=dry?value.dryRequestId:value.requestId;
      const payload={...value,mode:dry?'test':'live'};
      const r=req.url==='/status'?await dispatch.reconcile(request,payload):await dispatch.dispatch(request,payload);
      persistResult({operation:req.url.slice(1),...r});
      notice=r.status==='sent'?'알리고에서 발송완료를 확인했습니다.':r.status==='submitted'?'알리고 접수 완료. 실제 도착은 전송 결과 조회로 확인합니다.':r.status==='test_accepted'?'과금 없는 연동 시험을 통과했습니다.':'결과 확인이 필요합니다. 자동으로 다시 발송하지 않습니다.';
     }finally{dispatch.close();}
    }else return reply(404,'Unknown action');
   }
  }finally{busy=false;}
 }catch(e){notice=e instanceof AligoError?e.code:'연결 설정을 확인해 주세요.';}
 res.writeHead(303,{...headers,Location:'/'});res.end();
});
server.requestTimeout=20000;server.headersTimeout=10000;
server.listen(port,'127.0.0.1',()=>console.log('ALIGO_SETUP_READY '+origin));
