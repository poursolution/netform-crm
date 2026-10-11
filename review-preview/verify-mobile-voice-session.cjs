'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),factory=require('../mobile-voice-session.js');
const checks=[];
function rig({secure=true,available=true}={}){
 const events=new Map(),instances=[];let scope='owner1:session1:deal1',current=true,io=0;
 class Recognition{
  constructor(){this.starts=0;this.stops=0;this.aborts=0;instances.push(this);}
  start(){this.starts++;if(this.throwStart)throw Error('start');}
  stop(){this.stops++;if(this.throwStop)throw Error('stop');}
  abort(){this.aborts++;}
  fire(type,event={}){this['on'+type]?.(event);}
 }
 const root={isSecureContext:secure,SpeechRecognition:available?Recognition:null,addEventListener:(key,fn)=>{if(!events.has(key))events.set(key,new Set());events.get(key).add(fn);},removeEventListener:(key,fn)=>events.get(key)?.delete(fn),fetch:()=>{io++;throw Error('No network');},pushWrite:()=>{io++;throw Error('No save');}};
 const api=factory(root),session=api.create({getScope:()=>scope,isCurrent:()=>current}),callbacks={states:[],results:[],ends:[],errors:[]};
 const handlers={onState:s=>callbacks.states.push(s),onResult:s=>callbacks.results.push(s),onEnd:s=>callbacks.ends.push(s),onError:s=>callbacks.errors.push(s)};
 return {root,api,session,Recognition,instances,callbacks,handlers,setScope:s=>{scope=s;},setCurrent:x=>{current=x;},event:key=>[...(events.get(key)||[])].forEach(fn=>fn()),listeners:()=>[...events.values()].reduce((n,set)=>n+set.size,0),io:()=>io};
}
const result=(text,final)=>Object.assign([{transcript:text}],{isFinal:final});
{
 const r=rig();assert(r.api.supported());assert.equal(r.instances.length,0);assert.equal(r.session.snapshot().state,'idle');assert(r.session.start(r.handlers).ok);assert.equal(r.instances.length,1);const rec=r.instances[0];assert.equal(rec.starts,1);assert.equal(rec.lang,'ko-KR');assert.equal(rec.continuous,true);assert.equal(rec.interimResults,true);assert.equal(r.session.start().error,'VOICE_BUSY');r.session.cancel();assert.equal(r.listeners(),0);
 checks.push('Constructor/capability checks never open the microphone; only explicit start does, and concurrent starts are rejected');
}
{
 for(const config of [{available:false},{secure:false}]){const r=rig(config);assert.equal(r.api.supported(),false);assert.equal(r.session.start(r.handlers).error,'VOICE_UNSUPPORTED');assert.equal(r.instances.length,0);assert.equal(r.callbacks.errors.length,1);}
 checks.push('Unavailable or insecure browsers report unsupported without constructing a provider or inventing a transcript');
}
{
 const r=rig();r.session.start(r.handlers);const rec=r.instances[0];rec.fire('start');rec.fire('result',{results:[result('금요일 ',true),result('견적',false)]});assert.equal(r.session.snapshot().text,'금요일 견적');
 rec.fire('result',{resultIndex:1,results:[result('금요일 ',true),result('견적서',true)]});rec.fire('result',{resultIndex:0,results:[result('금요일 ',true),result('견적서',true)]});assert.equal(r.session.snapshot().text,'금요일 견적서');assert.equal(r.session.snapshot().finalText,'금요일 견적서');
 assert(r.session.stop().ok);assert.equal(rec.stops,1);r.session.stop();assert.equal(rec.stops,1);rec.fire('result',{results:[result('금요일 견적서 요청',true)]});rec.fire('end');assert.equal(r.callbacks.ends.length,1);assert.equal(r.callbacks.ends[0].text,'금요일 견적서 요청');assert.equal(r.session.snapshot().state,'ended');assert.equal(r.listeners(),0);assert.equal(r.io(),0);
 checks.push('Cumulative results replace interim text without duplicating finals; stop accepts final results until end and never saves or calculates a date');
}
{
 const r=rig();r.session.start(r.handlers);const rec=r.instances[0],late={result:rec.onresult,end:rec.onend,error:rec.onerror};r.session.cancel();assert.equal(rec.aborts,1);late.result({results:[result('취소 뒤 문자',true)]});late.end();late.error({error:'network'});assert.equal(r.callbacks.results.length,0);assert.equal(r.callbacks.ends.length,0);assert.equal(r.callbacks.errors.length,0);assert.equal(r.session.snapshot().state,'cancelled');
 r.session.start(r.handlers);late.result({results:[result('이전 세션 문자',true)]});assert.equal(r.session.snapshot().text,'');r.session.dispose();assert.equal(r.listeners(),0);assert.equal(r.session.start().error,'VOICE_DISPOSED');assert.equal(r.session.snapshot().text,'');
 checks.push('Cancel, restart and dispose invalidate late callbacks and remove listeners; cancelled speech cannot reappear in another session');
}
{
 for(const mode of ['profile','cleared','silent-scope','closed-view','pagehide']){
  const r=rig();r.session.start(r.handlers);const rec=r.instances[0],late=rec.onresult;
  if(mode==='profile'){r.setScope('owner2:session2:deal1');r.event('phase1:profile');}
  else if(mode==='cleared')r.event('phase1:identity-cleared');
  else if(mode==='silent-scope')r.setScope('owner1:session1:deal2');
  else if(mode==='closed-view')r.setCurrent(false);
  else r.event('pagehide');
  late({results:[result('다른 고객에게 들어가면 안 됨',true)]});assert.equal(r.callbacks.results.length,0);assert.equal(r.callbacks.ends.length,0);assert.equal(rec.aborts,1);assert.equal(r.listeners(),0);
 }
 checks.push('Account/session/deal/view changes and page exit abort recognition and reject late text without updating old UI callbacks');
}
{
 const r=rig();r.session.start(r.handlers);const rec=r.instances[0],late=rec.onend;rec.fire('error',{error:'not-allowed'});late();assert.equal(r.callbacks.errors[0].error,'VOICE_NOT-ALLOWED');assert.equal(r.callbacks.ends.length,0);assert.equal(r.listeners(),0);assert.equal(rec.aborts,1);
 const a=rig();class Bad extends a.Recognition{start(){throw Error('denied');}}const s=a.api.create({Recognition:Bad,getScope:()=> 'x'});assert.equal(s.start(a.handlers).error,'VOICE_START_FAILED');assert.equal(a.listeners(),0);
 const b=rig();b.session.start(b.handlers);b.instances[0].throwStop=true;assert.equal(b.session.stop().error,'VOICE_STOP_FAILED');assert.equal(b.listeners(),0);
 checks.push('Permission/recognition/start/stop failures clean up exactly once and remain errors rather than completed dictation');
}
{
 const r=rig();r.session.start(r.handlers);r.instances[0].fire('result',{results:[result('가'.repeat(305),true),result('나',false)]});assert.equal(r.session.snapshot().text,'가'.repeat(305)+'나');assert.equal(r.session.snapshot().truncated,false);assert.equal(r.session.snapshot().interimText,'나');r.session.dispose();
 const x=rig();x.session.start({onState:()=>x.session.cancel()});assert.equal(x.instances[0].starts,0);assert.equal(x.listeners(),0);
 checks.push('Dictation above300 characters is preserved as raw review text; cancelling inside start callbacks cannot start a hidden microphone');
}
{
 const r=rig();r.session.start(r.handlers);const rec=r.instances[0];rec.fire('result',{results:[result('가'.repeat(9000),true),result('나'.repeat(1000),false)]});assert.equal(r.session.snapshot().text.length,10000);assert.equal(r.session.snapshot().truncated,false);assert.equal(r.session.snapshot().state,'starting');
 const late={result:rec.onresult,end:rec.onend};rec.fire('result',{results:[result('가'.repeat(9000),true),result('나'.repeat(1001),false)]});assert.equal(r.session.snapshot().text,'가'.repeat(9000)+'나'.repeat(1000));assert.equal(r.session.snapshot().truncated,true);assert.equal(r.session.snapshot().error,'VOICE_TEXT_LIMIT');assert.equal(r.session.snapshot().state,'error');assert.equal(rec.aborts,1);assert.equal(r.listeners(),0);assert.equal(r.callbacks.errors.length,1);
 late.result({results:[result('뒤늦은 덮어쓰기',true)]});late.end();assert.equal(r.session.snapshot().text.length,10000);assert.equal(r.callbacks.ends.length,0);
 checks.push('Raw text up to10000 characters survives intact; crossing the bound retains its prefix with an explicit error, aborts recognition and rejects late completion');
}
{
 const r=rig();let reads=0;r.session.start(r.handlers);const results=new Proxy({length:1e9},{get(target,key){if(key==='length')return target.length;reads++;return result('',true);}});r.instances[0].fire('result',{results});assert.equal(reads,10000);assert.equal(r.session.snapshot().error,'VOICE_RESULT_LIMIT');assert.equal(r.instances[0].aborts,1);
 const x=rig(),custom=x.api.create({getScope:()=> 'scope',maxLength:700});custom.start();x.instances[0].fire('result',{results:[result('가'.repeat(1000000),true)]});assert.equal(custom.snapshot().text.length,700);assert.equal(custom.snapshot().error,'VOICE_TEXT_LIMIT');
 const capped=rig(),s=capped.api.create({getScope:()=> 'scope',maxLength:999999});s.start();capped.instances[0].fire('result',{results:[result('가'.repeat(10001),true)]});assert.equal(s.snapshot().text.length,10000);
 const malformed=rig();malformed.session.start(malformed.handlers);malformed.instances[0].fire('result',{results:[result('이전 정상 후보',true)]});malformed.instances[0].fire('result',{results:[result({toString(){throw Error('Do not coerce');}},true)]});assert.equal(malformed.session.snapshot().text,'이전 정상 후보');assert.equal(malformed.session.snapshot().error,'VOICE_RESULT_INVALID');
 checks.push('Result traversal and custom capacity are bounded before concatenation; oversized/malformed provider events terminate safely without coercion or losing the last valid candidate');
}
{
 const r=rig(),draft={res:'연결됨',memo:'기존 상담',mode:'keep',purpose:'기존 방문',date:'2026-10-15',reqOn:{a:true}},before=JSON.stringify(draft);
 r.session.start({onResult:()=>{}});r.instances[0].fire('result',{results:[result('금요일 발송해 주세요',true)]});r.session.stop();r.instances[0].fire('end');assert.equal(JSON.stringify(draft),before);assert.equal(r.io(),0);
 checks.push('Dictation exposes candidate text only: existing result, memo, next task/date and request selections remain untouched');
}
const report={at:new Date().toISOString(),passed:checks.length,checks,boundary:'Unit tests use fake native SpeechRecognition only; no microphone, audio file, real recognition provider, OCR, AI, database write or customer data was used. D→I2→D commit remains an explicit controller responsibility.'};
fs.writeFileSync(path.join(__dirname,'mobile-voice-session-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
