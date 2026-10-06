import { operationalSnapshot } from './lifecycle.mjs';
import { normalizeProject } from './normalize.mjs';
import { projectSnapshot } from './project.mjs';
const encoder = new TextEncoder();
const reply = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
export function handler({secret,store,now=Date.now}) {
  return async request => {
    if(request.method !== 'POST') return reply({error:'METHOD_NOT_ALLOWED'},405);
    if(!secret || secret.length<32) return reply({error:'NOT_CONFIGURED'},503);
    const timestamp=request.headers.get('x-crm-timestamp')||'';
    const signature=request.headers.get('x-crm-signature')||'';
    if(!/^\d{10}$/.test(timestamp)||Math.abs(now()/1000-Number(timestamp))>300||!/^[a-f0-9]{64}$/.test(signature)) return reply({error:'UNAUTHORIZED'},401);
    const reader=request.body?.getReader(); if(!reader) return reply({error:'EMPTY_BODY'},400);
    let size=0; const chunks=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>524288){await reader.cancel();return reply({error:'TOO_LARGE'},413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const body=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
    const sig=Uint8Array.from(signature.match(/../g).map(h=>parseInt(h,16)));
    if(!await crypto.subtle.verify('HMAC',key,sig,encoder.encode(timestamp+'.'+body)))return reply({error:'UNAUTHORIZED'},401);
    let input,normalized;
    try{input=JSON.parse(body);if(!/^[1-9]\d{0,24}$/.test(input.revision))throw Error();normalized=normalizeProject(input);}catch{return reply({error:'INVALID_CONTRACT_PAYLOAD'},400);}
    try { const ack=await store(input.projectId,input.revision,normalized,operationalSnapshot(input.data),projectSnapshot(input));return reply(ack); }
    catch{return reply({error:'PERSIST_FAILED'},503);}
  };
}
