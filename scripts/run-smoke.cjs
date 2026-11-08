'use strict';
/* PC 브라우저 검사 병렬 실행기 (2026-10-02): 검사가 늘어 순차 실행이 CI 제한 시간(15분)을 넘겨 취소되던 문제.
   인자로 받은 명령들을 동시에 몇 개씩 돌린다 — 검사마다 자기 서버(임의 포트)와 브라우저를 띄우므로 서로 간섭하지 않는다.
   하나라도 실패하면 그 출력과 함께 실패로 끝난다. 동시 실행 수: SMOKE_JOBS(기본 4).
   2026-11-08 병합 시간 줄이기(대표 지시):
   - SMOKE_SHARD=i/n — 검사를 n 묶음으로 나눠 i 번째 묶음만 돌린다(CI 는 컴퓨터 4대에 1/4 ~ 4/4). 걸리는 시간이 고르게 되도록
     smoke-weights.json 의 실측 초로 무거운 검사부터 가벼운 묶음에 넣는다. 같은 목록 · 같은 n 이면 어느 컴퓨터에서든 같은 묶음이 나온다.
   - 오래 걸리는 검사를 먼저 시작한다 — 마지막에 긴 검사 하나만 혼자 도는 시간을 줄인다.
   - 실패한 검사는 한 번만 다시 돌린다(SMOKE_RETRY=0 이면 끔). 다시 돌려 통과한 검사는 끝에 '다시 돌려 통과' 로 따로 적는다 —
     부하 때문에 가끔 시간 초과되던 검사(verify-inquiry-site 등) 때문에 전체 검사를 처음부터 다시 돌리던 10분을 없앤다. */
const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const all=process.argv.slice(2),jobs=Math.max(1,Number(process.env.SMOKE_JOBS)||4),retry=process.env.SMOKE_RETRY!=='0',failed=[],flaky=[];
if(!all.length){console.error('no commands');process.exit(2);}
let W={};try{W=JSON.parse(fs.readFileSync(path.join(__dirname,'smoke-weights.json'),'utf8')).seconds||{};}catch(e){}
const DEF=10,weight=cmd=>{const m=String(cmd).match(/[\w.-]+\.c?js\b/g);const k=m&&m[m.length-1];return k&&W[k]!=null?Number(W[k]):DEF;};
/* 무거운 순(같으면 원래 순서) */
const ordered=all.map((c,i)=>({c,i,w:weight(c)})).sort((a,b)=>b.w-a.w||a.i-b.i);
let cmds=ordered.map(x=>x.c);
const sh=String(process.env.SMOKE_SHARD||'').match(/^(\d+)\/(\d+)$/);
if(sh){const k=Number(sh[1]),n=Number(sh[2]);if(!(n>=1&&k>=1&&k<=n)){console.error('bad SMOKE_SHARD '+process.env.SMOKE_SHARD);process.exit(2);}
 const load=Array(n).fill(0),pick=Array.from({length:n},()=>[]);
 for(const x of ordered){let j=0;for(let t=1;t<n;t++)if(load[t]<load[j])j=t;load[j]+=x.w;pick[j].push(x.c);}
 cmds=pick[k-1];console.log('묶음 '+k+'/'+n+' · 검사 '+cmds.length+'개 · 예상 합계 '+Math.round(load[k-1])+'초 (전체 '+all.length+'개)');
 if(!cmds.length){console.log('\nsmoke passed: 0');process.exit(0);}}
if(process.env.SMOKE_LIST==='1'){console.log(cmds.join('\n'));process.exit(0);}/* 돌리지 않고 이 묶음 목록만 본다 */
let next=0,done=0;
function once(cmd){return new Promise(resolve=>{const t=Date.now(),p=spawn(cmd,{shell:true,env:process.env});let out='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>out+=d);
 p.on('close',code=>resolve({code,out,sec:Math.round((Date.now()-t)/1000)}));});}
async function run(cmd){let r=await once(cmd);
 if(r.code&&retry){console.log('RETRY ('+r.sec+'s) '+cmd+' — 한 번 다시 돌림\n'+r.out.trim().split('\n').slice(-12).join('\n'));const r2=await once(cmd);if(!r2.code){flaky.push(cmd);r=r2;r.retried=true;}else r=r2;}
 done++;if(r.code){failed.push(cmd);console.log('FAIL ('+r.sec+'s) '+cmd+'\n'+r.out.trim().split('\n').slice(-40).join('\n'));}else console.log('ok ('+r.sec+'s) ['+done+'/'+cmds.length+'] '+cmd+(r.retried?' (다시 돌려 통과)':''));}
async function worker(){while(next<cmds.length){await run(cmds[next++]);}}
Promise.all(Array.from({length:Math.min(jobs,cmds.length)},worker)).then(()=>{
 if(flaky.length)console.log('\n다시 돌려 통과: '+flaky.length+'\n'+flaky.join('\n'));
 if(failed.length){console.error('\nsmoke failed: '+failed.length+'\n'+failed.join('\n'));process.exit(1);}console.log('\nsmoke passed: '+cmds.length);});
