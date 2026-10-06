'use strict';
/* 이 단지 영업 이력 검사(2026-10-05 design_handoff_site_history · 시안 '같은 현장 다른 영업 v2.dc.html')
   영업건 상세 왼쪽 '같은 현장 다른 영업' 칸 → '이 단지 영업 이력': 제목 · 요약(누적 수주 · 진행 중) · 지금 보는 건이 맨 위인 타임라인 · AI 한 줄
   줄마다 [수정] 그 자리 편집(공종 · 결과 · 날짜 · 금액 · 담당 · 설명) · [삭제]는 지난 건만(두 번) · [+ 이력 추가] 수기 등록 · 저장마다 응대 이력 '이력 수정' · 누적 수주 다시 계산
   CRM 영업건 줄을 고쳐도 그 영업건 자체는 바뀌지 않는다. 서버 함수가 없으면 보기만. 끄기 G.siteHistoryOff */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealDetailV3&&window.DealKeyman&&window.DealPanelsV2&&window.DealDetailV2&&window.PipelineListV2&&window.DetailActions&&window.OpsStore);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   const S='aaaaaaaa-0000-4000-8000-000000000001';
   B={deals:[
    {id:'11111111-1111-4111-8111-111111111111',site:'[서울 도봉] 창동동아그린아파트',site_id:S,assignee:'황윤선',brand:'POUR솔루션',created:day(-60),code:'sent',stage_code:'sent',grp:'영업·관리',amt:38e7,manager_name:'김영수',manager_mobile:'01012345678',office_phone:'0212345678',
     contacts:[{person_key:'mobile:01012345678',name:'김영수',role:'관리소장',mobile:'01012345678',status:'current'},{person_key:'mobile:01011112222',name:'박영호',role:'이전 소장',mobile:'01011112222',status:'previous',ended_at:day(-3)},{person_key:'mobile:01077778888',name:'이회장',role:'입주자대표회장',mobile:'01077778888',status:'current'}],
     next_action:{id:'n1',text:'견적 후속 통화',due:day(2),status:'open'},
     activities:[{id:'a1',type:'전화',note:'소장 통화 — 견적 검토 중',at:at(-20)},{id:'a2',type:'업무',note:'관리소장 변경 — 이전 소장 기록',result:'박영호 · 010-1111-2222 · '+day(-3)+'까지 → 새 소장 김영수',at:at(-3)}],stage_contexts:{sent:{fields:{sent_date:day(-15),reaction:'가격 부담'}}}},
    {id:'22222222-2222-4222-8222-222222222222',site:'[서울 도봉] 창동동아그린아파트',site_id:S,assignee:'이필선',brand:'POUR솔루션',created:day(-500),updated:day(-400),code:'won',stage_code:'won',outcome:'won',won_amount:2e8,closed_at:day(-400),grp:'영업·관리',amt:2e8,workItems:['옥상>우레탄'],primaryWork:'옥상>우레탄',activities:[]},
    {id:'33333333-3333-4333-8333-333333333333',site:'다른 현장',assignee:'황윤선',brand:'POUR솔루션',created:day(-30),code:'sent',stage_code:'sent',grp:'영업·관리',amt:1e8,manager_name:'최소장',manager_mobile:'01099998888',contacts:[],activities:[]}],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.dkOpen=null;G.dealTidyOff=true;/* 이 검사는 정돈안 이전 배치(끄기 스위치 뒤)를 본다 — 정돈안은 scripts/verify-deal-tidy-browser.cjs */
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req-'+__writes.length;};
   window.__ops=[];window.queueDetailContactOperation=(op,payload,actionId)=>{const id='op-'+(__ops.length+1);__ops.push({id,op,payload,actionId});return id;};
   Phase1.queue.flush=async()=>{};Phase1.queue.list=()=>__ops.map(o=>({request_id:o.id,object_id:o.payload.opportunity_id,operation:o.op,status:'done',payload:o.payload,ack:{ok:true,operation:o.op,activity_id:'srv-'+o.id,next_action_id:'srv-'+o.id}})).concat(__writes.map((w,i)=>w[0]==='contact_upsert'?{request_id:'req-'+(i+1),object_id:w[1].opportunity_id,operation:'contact_upsert',status:'done',payload:w[1],ack:{ok:true,operation:'contact_upsert',person_key:w[1].person_key,contact_id:'c-'+i}}:null).filter(Boolean));
   window.__sf=[];window.__shStore=[];window.__shl=[];window.__shw=[];SB={rpc:async(name,args)=>{if(name==='crm_deal_stage_fields_update_v1'){__sf.push(args.p);const d=B.deals.find(x=>x.id===args.p.deal_id),cur=((d.stage_contexts||{})[args.p.stage_code]||{}).fields||{},fields=Object.assign({},cur);Object.entries(args.p.fields).forEach(([k,v])=>{if(v==null)delete fields[k];else fields[k]=v;});return {data:{ok:true,version:(d.version||1)+1,stage_context:{fields}}};}
   if(name==='crm_site_history_list_v1'){__shl.push(args.p);return window.__shMissing?{error:{code:'PGRST202',message:'not found'}}:{data:{ok:true,entries:JSON.parse(JSON.stringify(__shStore))}};}
   if(name==='crm_site_history_write_v1'){const p=args.p;__shw.push(JSON.parse(JSON.stringify(p)));let e=p.entry_id?__shStore.find(x=>x.id===p.entry_id):p.target_deal_id?__shStore.find(x=>x.deal_id===p.target_deal_id):null;const was=!!e;
    if(p.op==='delete'){if(p.target_deal_id&&p.target_deal_id===p.deal_id)return {error:{message:'지금 보는 건은 삭제할 수 없습니다'}};if(!e){e={id:'e-'+(__shStore.length+1),site_id:'s',deal_id:p.target_deal_id||null,source:'crm',created_at:new Date().toISOString()};__shStore.push(e);}e.hidden=true;}
    else{if(p.fields.result==='실주'&&!p.fields.lost_reason)return {error:{message:'실주 원인을 골라 주세요'}};if(!e){e={id:'e-'+(__shStore.length+1),site_id:'s',deal_id:p.target_deal_id||null,source:p.target_deal_id?'crm':'manual',created_at:new Date().toISOString()};__shStore.push(e);}Object.assign(e,p.fields,{hidden:false});}
    e.version=(e.version||0)+1;return {data:{ok:true,op:p.op,entry:JSON.parse(JSON.stringify(e)),activity:{id:'act-'+__shw.length,occurred_at:new Date().toISOString(),type:'이력 수정',actor_name:'송보람',detail:{note:'이 단지 영업 이력 '+(p.op==='delete'?'삭제':was||p.target_deal_id?'수정':'추가'),result:p.summary}}}};}
   if(name==='crm_deal_closed_info_update_v1'){window.__ci=window.__ci||[];__ci.push(args.p);if(window.__ciMissing)return {error:{code:'PGRST202',message:'function not found'}};const d=B.deals.find(x=>x.id===args.p.deal_id),cur=((d.stage_contexts||{})[args.p.stage_code]||{}).fields||{},fields=Object.assign({},cur);Object.entries(args.p.fields||{}).forEach(([k,v])=>{if(v==null)delete fields[k];else fields[k]=v;});return {data:{ok:true,version:(d.version||1)+1,stage_code:args.p.stage_code,stage_context:{to:args.p.stage_code,fields},amount:args.p.amount!=null?args.p.amount:(d.amount??d.amt??null)}};}
   return {data:{ok:true,tasks:[]}};}};TOKEN='test';
   window.__ai=[];OpsStore.aiOn=()=>true;OpsStore.ai=async(kind)=>{__ai.push(kind);return {suggestion:kind==='next_action'?{how:'전화',what:'새 소장에게 기존 견적 조건 설명',days:1,why:'관리소장 변경 뒤 첫 응대가 없음'}:{opener:'안녕하세요 소장님',goal:'조건 확인',summary:''}};};
   window.__work=[];const fake={current:null,openWork:async(id,item)=>{fake.current=item;CUR_DETAIL={kind:'deal',key:dealKey(item),item};openWorkEdit();},save:async(item,payload)=>{if(item!==fake.current)throw Error('EDITOR_IDENTITY_MISMATCH');__work.push(payload);item.workItems=payload.work_items;item.primaryWork=payload.primary_work;closeNewDeal();renderDetail();}};window.Phase11=fake;
   G.pipeStageBOff=true;PipelineWorkspace.open('sent');
  });
  await page.waitForTimeout(200);
  await page.locator('#pipeline-list-v2 .plv-row',{hasText:'창동동아그린'}).locator('.plv-site').click();await page.waitForTimeout(600);
  const v=page.locator('#detailView.ddv.dv3');assert.equal(await v.count(),1,'정리된 상세');
  const CUR='11111111-1111-4111-8111-111111111111',WON='22222222-2222-4222-8222-222222222222',LOST='44444444-4444-4444-8444-444444444444';
  /* 같은 단지의 지난 실주 건을 하나 더 넣고 다시 그린다 */
  await page.evaluate(id=>{const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA');B.deals.push({id,site:'[서울 도봉] 창동동아그린아파트',site_id:'aaaaaaaa-0000-4000-8000-000000000001',assignee:'김성민',brand:'POUR솔루션',created:day(-900),code:'lost',stage_code:'lost',outcome:'lost',lifecycle_status:'closed',closed_at:day(-800),grp:'영업·관리',amt:21e6,work:'지하주차장 에폭시',stage_contexts:{lost:{fields:{competitor:'A건설',close_detail:'단가 18% 차이'}}},contacts:[],activities:[]});SiteHistory.reset();renderDetail();},LOST);await page.waitForTimeout(600);
  const L=v.locator('.dv3-left'),H=v.locator('.dv3-left .sth'),rows=()=>H.locator('.sth-list>.sth-row'),row=t=>H.locator('.sth-list>.sth-row',{hasText:t});
  const toasts=()=>page.evaluate(()=>__toasts.map(x=>x[0]));await page.evaluate(()=>{window.__toasts=[];const o=window.toast;window.toast=(m,k)=>{__toasts.push([String(m),k||'']);return o&&o(m,k);};});
  /* 1. 칸 이름 · 제목 · 요약 */
  assert.deepEqual(await L.locator('.dv3-sec>header b').allInnerTexts(),['이 단지 영업 이력','담당 정보','자료','다른 연락처']);assert.equal(await L.locator('.dv3-rel').count(),0,'예전 칸은 없다');
  assert.deepEqual(await H.locator(':scope>.sth-hd').evaluate(n=>[...n.children].map(x=>x.textContent).filter(Boolean)),['이 단지 영업 이력','3건','+ 이력 추가']);
  assert.equal((await H.locator('.sth-sum').innerText()).replace(/\s+/g,' '),'누적 수주 2억 (1건) · 진행 중 1건');
  assert.deepEqual(await page.evaluate(()=>__shl.slice(-1)[0]),{deal_id:CUR,deal_ids:[WON,LOST]},'같은 단지 영업건을 함께 읽는다');
  /* 2. 타임라인: 지금 보는 건이 맨 위 · 검은 점 · 꼬리표, 지난 건은 최신 → 과거 */
  const view=await rows().evaluateAll(l=>l.map(n=>({cls:n.className.replace('sth-row','').trim(),work:n.querySelector('.sth-l1 b').textContent,tag:n.querySelector('.sth-l1 em').textContent,tc:getComputedStyle(n.querySelector('.sth-l1 em')).backgroundColor,l2:n.querySelector('.sth-l2').textContent,l3:(n.querySelector('.sth-l3')||{}).textContent||'',dot:getComputedStyle(n.querySelector('.sth-dot i')).backgroundColor,ring:getComputedStyle(n.querySelector('.sth-dot i')).borderTopColor,line:!!n.querySelector('.sth-dot u'),bg:getComputedStyle(n).backgroundColor,edit:!!n.querySelector('[data-sth="edit"]')})));
  assert.equal(view.length,3);assert.deepEqual(view.map(x=>x.tag),['지금 보는 건 · 진행','수주','실주']);assert.deepEqual(view.map(x=>x.cls),['cur','past link','past link']);
  assert.deepEqual([view[0].dot,view[0].tc,view[0].bg],['rgb(21, 23, 28)','rgb(21, 23, 28)','rgb(245, 246, 248)'],'지금 보는 건 = 검은 점 · 검은 꼬리표 · 옅은 배경');
  assert.deepEqual([view[1].ring,view[1].tc,view[2].ring,view[2].tc],['rgb(63, 179, 127)','rgb(232, 246, 238)','rgb(209, 74, 63)','rgb(253, 236, 236)'],'수주 초록 · 실주 빨강');
  assert.deepEqual(view.map(x=>x.line),[true,true,false],'마지막 줄에는 선이 없다');assert.ok(view.every(x=>x.edit),'줄마다 [수정]');
  assert.match(view[0].l2,/^\d{4}\.\d{1,2} 문의 · 3\.8억 · 황윤선$/);assert.match(view[0].l3,/^자료 발송완료 · 다음: 견적 후속 통화$/);
  assert.equal(view[1].work,'옥상(우레탄)');assert.match(view[1].l2,/^\d{4}\.\d{1,2} 계약 · 2억 · 이필선$/);
  assert.equal(view[2].work,'지하주차장 에폭시');assert.match(view[2].l2,/^\d{4}\.\d{1,2} 종료 · 2,100만 · 김성민$/);assert.equal(view[2].l3,'A건설 낙찰 · 단가 18% 차이');
  /* 3. AI 한 줄: 지난 수주 이력으로 */
  assert.match(await H.locator('.sth-ai').innerText(),/^AI\s*이 단지는 \d{4}년 옥상\(우레탄\)를 맡긴 기존 고객입니다\. 첫 통화에서 "옥상\(우레탄\) 공사 이후 문제 없으셨는지"부터 여쭤보세요\.$/);
  if(shot)await H.screenshot({path:shot+'-view.png'});
  /* 4. 지난 건을 누르면 그 영업건 상세 */
  await row('옥상(우레탄)').locator('.sth-l2').click();await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>CUR_DETAIL.item.id),WON);
  assert.equal(await page.locator('#detailView .sth .sth-row.cur .sth-l1 em').innerText(),'지금 보는 건 · 수주','그 건에서는 그 건이 맨 위');
  await page.evaluate(id=>{G._detailPopup=true;drwDeal(JSON.stringify(B.deals.find(d=>d.id===id)));},CUR);await page.waitForTimeout(700);
  /* 5. [수정] = 그 자리 편집: 공종 · 결과 칩 · 날짜 · 금액 · 담당 · 설명 → [취소] [저장], [삭제]는 지난 건만 */
  await row('옥상(우레탄)').locator('[data-sth="edit"]').click();await page.waitForTimeout(200);
  const F=H.locator('.sth-row.ed');assert.equal(await F.count(),1);assert.equal(await page.evaluate(()=>CUR_DETAIL.item.id),CUR,'수정을 눌러도 그 건이 열리지 않는다');
  assert.deepEqual(await F.locator('.sth-grid>span').allInnerTexts(),['공종','결과','날짜','금액','담당','설명']);
  assert.deepEqual(await F.locator('.sth-chips button').evaluateAll(l=>l.map(b=>b.textContent+(b.getAttribute('aria-pressed')==='true'?'*':''))),['진행','수주*','실주','보류','배드핏']);
  assert.deepEqual(await F.evaluate(n=>[n.querySelector('[data-sthf="work"]').value,n.querySelector('[data-sthf="amt"]').value,n.querySelector('[data-sthf="who"]').value,n.querySelector('[data-sthf="amt"]').placeholder,n.querySelector('[data-sthf="when"]').placeholder,n.querySelector('[data-sthf="hint"]').placeholder]),['옥상(우레탄)','2억','이필선','낙찰금액 · 450만','2025.11 계약','준공 · 하자 / 실주 사유 · 낙찰사']);
  assert.deepEqual(await F.locator('.sth-foot button').allInnerTexts(),['삭제','취소','저장']);assert.equal(await F.locator('.sth-fn').innerText(),"저장하면 응대 이력에 '이력 수정' 시스템 기록이 남습니다");
  assert.equal(await H.locator('.sth-add').isDisabled(),true,'편집 중에는 추가 버튼 잠금');
  if(shot)await H.screenshot({path:shot+'-edit.png'});
  await F.locator('[data-sthf="amt"]').fill('450만');await F.locator('[data-sthf="who"]').selectOption('김성민');await F.locator('[data-sthf="hint"]').fill('2026.2 준공 · 하자 접수 없음');
  await F.locator('[data-sth="save"]').click();await page.waitForTimeout(600);
  const w1=await page.evaluate(()=>__shw.slice(-1)[0]);
  assert.deepEqual([w1.deal_id,w1.op,w1.target_deal_id,w1.entry_id],[CUR,'save',WON,undefined]);assert.deepEqual(w1.fields,{work:'옥상(우레탄)',result:'수주',when_text:w1.fields.when_text,amount:4500000,owner_name:'김성민',note:'2026.2 준공 · 하자 접수 없음',lost_reason:null});assert.match(w1.fields.when_text,/^\d{4}\.\d{1,2} 계약$/);
  assert.equal(w1.summary,'옥상(우레탄) — 금액: 2억 → 450만 · 담당: 이필선 → 김성민 · 설명: 없음 → 2026.2 준공 · 하자 접수 없음','무엇 전 → 후');assert.deepEqual(w1.before,{work:'옥상(우레탄)',result:'수주',when:w1.fields.when_text,amount:200000000,owner:'이필선',note:''});
  assert.match(await row('옥상(우레탄)').locator('.sth-l2').innerText(),/계약 · 450만 · 김성민$/);assert.equal(await row('옥상(우레탄)').locator('.sth-l3').innerText(),'2026.2 준공 · 하자 접수 없음');
  assert.equal((await H.locator('.sth-sum').innerText()).replace(/\s+/g,' '),'누적 수주 450만 (1건) · 진행 중 1건','누적 수주 다시 계산');
  assert.deepEqual(await page.evaluate(id=>{const d=B.deals.find(x=>x.id===id);return [d.won_amount,d.assignee,d.outcome];},WON),[200000000,'이필선','won'],'그 영업건 자체(수주금액 · 담당 · 종료 상태)는 그대로');
  assert.match(await page.locator('#detailView .dw-center').innerText(),/이력 수정[\s\S]*이 단지 영업 이력 수정[\s\S]*옥상\(우레탄\) — 금액: 2억 → 450만 · 담당: 이필선 → 김성민/,"응대 이력에 '이력 수정' 기록");
  assert.equal((await toasts()).slice(-1)[0],'이력을 고쳤습니다 — 응대 이력에 기록됨');
  /* 바뀐 것이 없으면 저장하지 않는다 */
  {const n=await page.evaluate(()=>__shw.length);await row('옥상(우레탄)').locator('[data-sth="edit"]').click();await page.waitForTimeout(150);await H.locator('.sth-row.ed [data-sth="save"]').click();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>__shw.length),n);assert.equal((await toasts()).slice(-1)[0],'바뀐 내용이 없습니다');}
  /* 6. 실주로 저장하려면 실주 원인(분류 → 세부 사유) */
  await row('지하주차장 에폭시').locator('[data-sth="edit"]').click();await page.waitForTimeout(200);
  {const E=H.locator('.sth-row.ed');assert.deepEqual(await E.locator('.sth-grid>span').allInnerTexts(),['공종','결과','사유','날짜','금액','담당','설명'],'실주면 사유 줄');
   const cats=await E.locator('.sth-lost .sth-chips button').allInnerTexts();assert.ok(cats.length>=4,'실주 원인 분류 '+JSON.stringify(cats));
   await E.locator('[data-sthf="hint"]').fill('가격 · A건설 낙찰 (−18%)');const n=await page.evaluate(()=>__shw.length);await E.locator('[data-sth="save"]').click();await page.waitForTimeout(300);
   assert.equal(await page.evaluate(()=>__shw.length),n,'사유 없이는 저장하지 않는다');assert.match((await toasts()).slice(-1)[0],/실주 원인을 골라 주세요/);
   await H.locator('.sth-row.ed .sth-lost .sth-chips button').first().click();await page.waitForTimeout(200);const sel=H.locator('.sth-row.ed [data-sthf="lost"]');assert.equal(await sel.count(),1,'세부 사유 선택');const val=await sel.locator('option').nth(1).getAttribute('value');await sel.selectOption(val);
   assert.equal(await H.locator('.sth-row.ed [data-sthf="hint"]').inputValue(),'가격 · A건설 낙찰 (−18%)','칩을 눌러도 적던 내용은 그대로');
   await H.locator('.sth-row.ed [data-sth="save"]').click();await page.waitForTimeout(600);
   const w=await page.evaluate(()=>__shw.slice(-1)[0]);assert.deepEqual([w.op,w.target_deal_id,w.fields.result,w.fields.lost_reason,w.fields.note],['save',LOST,'실주',val,'가격 · A건설 낙찰 (−18%)']);assert.match(w.summary,/^지하주차장 에폭시 — 설명: A건설 낙찰 · 단가 18% 차이 → 가격 · A건설 낙찰 \(−18%\) · 실주 원인: 없음 → /);}
  /* 7. [+ 이력 추가] = 빈 편집칸 · 취소하면 사라짐 · 저장 = 수기 등록 */
  await H.locator('.sth-add').click();await page.waitForTimeout(200);assert.equal(await H.locator('.sth-row.ed.new').count(),1);assert.deepEqual(await H.locator('.sth-row.ed.new .sth-foot button').allInnerTexts(),['취소','저장'],'새 줄에는 삭제 없음');
  assert.deepEqual(await H.locator('.sth-row.ed.new').evaluate(n=>[n.querySelector('[data-sthf="work"]').value,n.querySelector('.sth-chips [aria-pressed="true"]').textContent,document.activeElement===n.querySelector('[data-sthf="work"]')]),['','수주',true]);
  await H.locator('.sth-row.ed.new [data-sth="cancel"]').click();await page.waitForTimeout(200);assert.equal(await rows().count(),3,'취소하면 사라진다');
  await H.locator('.sth-add').click();await page.waitForTimeout(200);
  {const N=H.locator('.sth-row.ed.new');await N.locator('[data-sthf="work"]').fill('외벽 재도장');await N.locator('[data-sthf="when"]').fill('2021.4 계약');await N.locator('[data-sthf="amt"]').fill('1.2억');await N.locator('[data-sthf="hint"]').fill('타 업체 시공');
   const n=await page.evaluate(()=>__shw.length);await N.locator('[data-sthf="work"]').fill('');await N.locator('[data-sth="save"]').click();await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>__shw.length),n);assert.equal((await toasts()).slice(-1)[0],'공종을 적어 주세요');
   await H.locator('.sth-row.ed.new [data-sthf="work"]').fill('외벽 재도장');await H.locator('.sth-row.ed.new [data-sthf="hint"]').press('Enter');await page.waitForTimeout(600);}
  {const w=await page.evaluate(()=>__shw.slice(-1)[0]);assert.deepEqual([w.op,w.entry_id,w.target_deal_id,w.before],['save',undefined,undefined,undefined]);assert.deepEqual(w.fields,{work:'외벽 재도장',result:'수주',when_text:'2021.4 계약',amount:120000000,owner_name:'황윤선',note:'타 업체 시공',lost_reason:null});assert.equal(w.summary,'추가 — 외벽 재도장 · 수주 · 2021.4 계약 · 1.2억 · 황윤선 · 타 업체 시공 (수기 등록)');}
  assert.equal(await rows().count(),4);assert.equal(await H.locator(':scope>.sth-hd span').innerText(),'4건');
  assert.deepEqual(await row('외벽 재도장').evaluate(n=>[n.className.replace('sth-row','').trim(),n.querySelector('.sth-man').textContent,n.querySelector('.sth-l2').textContent]),['past','수기','2021.4 계약 · 1.2억 · 황윤선'],'수기 줄은 표시가 붙고 눌러도 열 영업건이 없다');
  assert.equal(await rows().last().locator('.sth-l1 b').innerText(),'외벽 재도장','가장 오래된 것이 맨 아래');
  assert.equal((await H.locator('.sth-sum').innerText()).replace(/\s+/g,' '),'누적 수주 '+await page.evaluate(()=>fmtAmt(124500000))+' (2건) · 진행 중 1건');
  if(shot)await H.screenshot({path:shot+'-added.png'});
  /* 8. [삭제]: 지난 건만 · 두 번 눌러야 · 수기 줄은 지워지고 CRM 줄은 이력에서만 빠진다 */
  await rows().first().locator('[data-sth="edit"]').click();await page.waitForTimeout(200);assert.deepEqual(await H.locator('.sth-row.ed .sth-foot button').allInnerTexts(),['취소','저장'],'지금 보는 건은 삭제 불가');await H.locator('.sth-row.ed [data-sth="cancel"]').click();await page.waitForTimeout(150);
  await row('외벽 재도장').locator('[data-sth="edit"]').click();await page.waitForTimeout(200);
  {const n=await page.evaluate(()=>__shw.length);await H.locator('.sth-row.ed [data-sth="del"]').click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>__shw.length),n);assert.equal(await H.locator('.sth-row.ed [data-sth="del"]').innerText(),'한 번 더 누르면 삭제');
   await H.locator('.sth-row.ed [data-sth="del"]').click();await page.waitForTimeout(600);const w=await page.evaluate(()=>__shw.slice(-1)[0]);assert.deepEqual([w.op,!!w.entry_id,w.target_deal_id],['delete',true,undefined]);assert.equal(w.summary,'삭제 — 외벽 재도장 · 수주 · 2021.4 계약 · 1.2억 · 황윤선 · 타 업체 시공');}
  assert.equal(await rows().count(),3);
  await row('지하주차장 에폭시').locator('[data-sth="edit"]').click();await page.waitForTimeout(200);await H.locator('.sth-row.ed [data-sth="del"]').click();await page.waitForTimeout(150);await H.locator('.sth-row.ed [data-sth="del"]').click();await page.waitForTimeout(600);
  {const w=await page.evaluate(()=>__shw.slice(-1)[0]);assert.equal(w.op,'delete');assert.match(w.summary,/^삭제 — 지하주차장 에폭시 · 실주 · .* \(이력에서만 뺌 · 영업건은 그대로\)$/);assert.equal(await rows().count(),2);assert.equal(await page.evaluate(id=>B.deals.some(d=>d.id===id),LOST),true,'영업건은 지워지지 않는다');}
  assert.equal(await page.evaluate(()=>(CUR_DETAIL.item.activities||[]).filter(a=>a.type==='이력 수정').length),5,"저장 · 추가 · 삭제마다 '이력 수정' 기록");
  /* 9. 금액 읽기 */
  assert.deepEqual(await page.evaluate(()=>['450만','2,100만','1.2억','1억 2,000만','450','4500000','','가나다'].map(SiteHistory.parseAmt)),[4500000,21000000,120000000,120000000,4500000,4500000,null,NaN]);
  /* 10. 서버 함수가 아직 없으면: 타임라인은 보이고 수정 · 추가 버튼은 없다 · 끄면 예전 칸 */
  await page.evaluate(()=>{window.__shMissing=true;window.__missed=[];const n0=CRMRelease.noteMissing,h0=CRMRelease.has;window.__relKeep=[n0,h0];CRMRelease.noteMissing=n=>{__missed.push(n);};CRMRelease.has=n=>__missed.includes(n)?false:h0(n);SiteHistory.reset();renderDetail();});await page.waitForTimeout(700);
  assert.deepEqual(await page.evaluate(()=>__missed),['crm_site_history_list_v1']);assert.equal(await page.locator('#detailView .sth .sth-row').count(),3);assert.equal(await page.locator('#detailView .sth [data-sth="edit"],#detailView .sth .sth-add').count(),0,'서버 적용 전에는 보기만');
  await page.evaluate(()=>{window.__shMissing=false;CRMRelease.noteMissing=__relKeep[0];CRMRelease.has=__relKeep[1];G.siteHistoryOff=true;renderDetail();});await page.waitForTimeout(500);
  assert.equal(await page.locator('#detailView .sth').count(),0);assert.deepEqual(await page.locator('#detailView .dv3-left .dv3-sec>header b').allInnerTexts(),['같은 현장 다른 영업','담당 정보','자료','다른 연락처'],'끄면 예전 칸');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',title_and_summary:true,timeline_current_first:true,ai_line_from_history:true,past_row_opens_deal:true,inline_edit_six_fields:true,edit_logs_and_recalculates:true,lost_needs_reason:true,add_manual_entry:true,delete_two_step_past_only:true,deal_itself_untouched:true,server_missing_read_only:true,switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
