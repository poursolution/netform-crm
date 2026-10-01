'use strict';
/* PC 브라우저 검사 병렬 실행기 (2026-10-02): 검사가 늘어 순차 실행이 CI 제한 시간(15분)을 넘겨 취소되던 문제.
   인자로 받은 명령들을 동시에 몇 개씩 돌린다 — 검사마다 자기 서버(임의 포트)와 브라우저를 띄우므로 서로 간섭하지 않는다.
   하나라도 실패하면 그 출력과 함께 실패로 끝난다. 동시 실행 수: SMOKE_JOBS(기본 4). */
const {spawn}=require('node:child_process');
const cmds=process.argv.slice(2),jobs=Math.max(1,Number(process.env.SMOKE_JOBS)||4),failed=[];let next=0,done=0;
if(!cmds.length){console.error('no commands');process.exit(2);}
function run(cmd){return new Promise(resolve=>{const t=Date.now(),p=spawn(cmd,{shell:true,env:process.env});let out='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>out+=d);
 p.on('close',code=>{done++;const sec=Math.round((Date.now()-t)/1000);if(code){failed.push(cmd);console.log('FAIL ('+sec+'s) '+cmd+'\n'+out.trim().split('\n').slice(-40).join('\n'));}else console.log('ok ('+sec+'s) ['+done+'/'+cmds.length+'] '+cmd);resolve();});});}
async function worker(){while(next<cmds.length){await run(cmds[next++]);}}
Promise.all(Array.from({length:Math.min(jobs,cmds.length)},worker)).then(()=>{if(failed.length){console.error('\nsmoke failed: '+failed.length+'\n'+failed.join('\n'));process.exit(1);}console.log('\nsmoke passed: '+cmds.length);});
