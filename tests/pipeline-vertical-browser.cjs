'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');

(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
 try{
  const page=await browser.newPage();
  await page.setContent('<main id="p-main"></main>');
  await page.addStyleTag({path:path.join(__dirname,'../pipeline-vertical.css')});
  await page.evaluate(()=>{
   window.G={rep:'전체',brand:'전체',workFilter:'전체',q:''};window.ME={name:'김영업',role:'rep',permission_role:'rep'};
   window.STAGE_SEQ=['first_contact','consulting','sent','rapport','silent','waiting','compete','imminent','bidding','contract','construction','completion'];
   window.STAGE_MASTER=Object.fromEntries(STAGE_SEQ.map((code,i)=>[code,{name:['1차 접촉·니즈파악','컨설팅 설계','자료 발송완료','유대관계 강화','침묵 관리','대기고객(사후보류)','경쟁단계(PT)','공사 임박','입찰단계','계약단계','시공단계','준공단계'][i],macro:i<2?'design':i===2?'sent':i<6?'rel':i<9?'comp':'con'}]));
   const deal=(site,code,assignee,amt,due,stale=false)=>({site,code,assignee,amt,brand:'A',work:'옥상방수',next:due?{text:site+' 후속 연락',due}:null,stale});
   window.B={deals:[deal('기한초과 현장','first_contact','김영업',5000,'2026-09-15'),deal('오늘 현장','sent','김영업',4000,'2026-09-17'),deal('Next 없는 현장','rapport','김영업',3000),deal('정체 현장','compete','김영업',2000,'2026-09-25',true),deal('계약 현장','contract','김영업',1000,'2026-09-30'),deal('다른 담당 현장','first_contact','박영업',9000,'2026-09-17'),deal('종료 현장','won','김영업',8000,'2026-09-10')]};
   window.KB5_CACHE=[];window.esc=String;window.repN=String;window.pipeFiltered=()=>B.deals.filter(d=>!['won','lost'].includes(d.code));window.itemPatch=()=>({});window.actionObj=d=>d.next;window.daysTo=d=>Math.round((new Date(d+'T00:00:00')-new Date('2026-09-17T00:00:00'))/86400000);window.issueSet=d=>d.stale?['stale']:[];window.briefVoiceOfCustomer=()=>[];window.relationshipMeta=()=>({});window.activityAge=()=>2;window.macroOf=c=>({design:'design',sent:'sent',rel:'rel',comp:'comp',con:'con',won:'won',lost:'lost'})[c];window.dealStage=d=>d.code;window.stageLabel=String;window.dealWorkSummary=d=>d.work;window.subStatus=()=>'-';window.fmtAmt=n=>Number(n).toLocaleString()+'원';window.sum=rows=>rows.reduce((n,d)=>n+Number(d.amt||0),0);window.forecastProbability=()=>.5;window.age=()=>0;window.workMatches=()=>true;window.fmtD=String;window.openKb5=()=>{};window.pipelineQuick=()=>{};
  });
  await page.addScriptTag({path:path.join(__dirname,'../pipeline-vertical.js')});
  await page.evaluate(()=>paintKanban());
  assert.equal(await page.locator('.pv-section').count(),13);
  assert.equal(await page.locator('.pv-section.collapsed').count(),8);
  assert.equal(await page.locator('.pv-row').count(),6,'non-admin sees only own five open deals and one closed deal');
  assert.deepEqual(await page.locator('.pv-row').first().locator('button').allTextContents(),['기록','다음 행동','단계 이동']);
  for(const width of [1920,1440,1280]){
   await page.setViewportSize({width,height:900});
   const overflow=await page.evaluate(()=>({doc:document.documentElement.scrollWidth-document.documentElement.clientWidth,main:document.querySelector('#p-main').scrollWidth-document.querySelector('#p-main').clientWidth}));
   assert.ok(overflow.doc<=0&&overflow.main<=0,width+'px horizontal overflow: '+JSON.stringify(overflow));
  }
  console.log('PASS: vertical pipeline at 1920/1440/1280 without horizontal scroll');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
