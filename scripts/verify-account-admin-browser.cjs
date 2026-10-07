'use strict';
/* 직원 계정 관리 v2 검사(2026-10-05 design_handoff_accounts · 직원 계정 관리 v2.dc.html)
   가운데 창(최대 880px) · 머리(n명 · 로그인 연결 n명 · [+ 계정 추가] · ×) · 역할 알약 + 검색 · 한 줄 = 한 사람(10명이 한 화면) ·
   본인 = 버튼 없음 · 미연결 = 주황 글자 + 검정 [계정 연결] · [비밀번호 재설정] → 확인 → 임시 비밀번호(복사 · 닫으면 다시 못 봄) ·
   [+ 계정 추가] → 목록에 바로 + 임시 비밀번호 · [···] → 비활성화(삭제 아님) · 관리자만 · 서버 함수가 없으면 추가 · 연결 · 비활성화는 잠김 · 끄면 예전 창.
   첫 로그인 변경 강제: 임시 비밀번호로 로그인한 계정은 비밀번호 변경 창이 닫히지 않는다.
   서버 함수는 이 검사 안의 가짜 저장소로 흉내 낸다(실제 규칙은 sql/admin-accounts-v2-20261005.sql + tests/admin-accounts-v2.test.mjs). */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const PW=/^NF-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const origin=`http://127.0.0.1:${srv.address().port}`;
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul',permissions:['clipboard-read','clipboard-write']});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(origin+'/crm.html');await page.waitForFunction(()=>window.AccountAdmin&&window.CRMPassword&&window.Phase1&&typeof repProfile==='function');

  /* 로그인 이름 칸: 명단에 있는 이름은 그대로, 새로 만든 계정은 이메일을 그대로 넣는다 */
  assert.deepEqual(await page.evaluate(()=>[Phase1.loginEmail('이필선'),Phase1.loginEmail(' ParkJihoon@crm.netform.co.kr '),Phase1.loginEmail('없는사람'),Phase1.loginEmail('a@b')]),['ipilseon@crm.netform.co.kr','parkjihoon@crm.netform.co.kr',null,null]);

  /* 가짜 서버: 운영과 같은 10명(로그인 연결 8) + 비활성 2 */
  const seed=v2=>page.evaluate(v2=>{
   const real=window.__realPhase1||(window.__realPhase1=window.Phase1);
   const mk=(n,name,role,mail,last,extra)=>Object.assign({user_id:'00000000-0000-4000-8000-0000000000'+String(n).padStart(2,'0'),name,role,active:true,email:mail,linked:!!mail,last_sign_in_at:last,self:false},extra||{});
   const db=window.__db={v2,calls:[],users:[
    mk(1,'송보람','admin','songboram@crm.netform.co.kr','2026-10-05T01:00:00Z',{self:true}),mk(2,'이승우','dual','iseungwoo@crm.netform.co.kr',null),
    mk(3,'황윤선','dual','hwangyunseon@crm.netform.co.kr','2026-10-04T03:00:00Z'),mk(4,'한준엽','rep','hanjunyeop@crm.netform.co.kr','2026-10-03T03:00:00Z'),
    mk(5,'이필선','rep','ipilseon@crm.netform.co.kr','2026-10-02T03:00:00Z'),mk(6,'정정훈','rep','jeongjeonghun@crm.netform.co.kr',null),
    mk(7,'김성민','rep','kimseongmin@crm.netform.co.kr',null),mk(8,'조현식','rep','johyeonsik@crm.netform.co.kr','2026-09-30T03:00:00Z'),
    mk(9,'조재연','rep',null,null),mk(10,'경남지사','rep',null,null),
    mk(11,'주현진','rep',null,null,{active:false}),mk(12,'한인규','viewer',null,null,{active:false})]};
   const err=m=>Object.assign(Error(m),{code:'P0001'});
   const out=u=>{const x=Object.assign({},u);if(db.v2){x.permission_role=u.linked?(u.permission_role||(u.role==='rep'?'rep':'admin')):null;x.kind=u.kind||null;x.team=u.team||null;x.must_change=!!u.must_change;x.created_at='2026-09-07T00:00:00Z';}else{delete x.kind;delete x.team;delete x.must_change;delete x.permission_role;}return x;};
   window.__profile={permission_role:'admin',auth_uid:'u-admin',user_id:db.users[0].user_id,name:'송보람'};
   const rpc=async(name,args)=>{
    db.calls.push([name,JSON.parse(JSON.stringify(args||{}))]);
    if(name==='crm_my_credential_state_v1'){if(window.__must==='missing')throw Object.assign(Error('missing'),{code:'PGRST202'});const m=!!window.__must;if(window.__mustClearNext)window.__must=false;return {ok:true,must_change:m};}
    if(window.__profile.permission_role!=='admin')throw err('forbidden');
    if(name==='crm_admin_list_accounts_v1')return {ok:true,policy:'admin-accounts-v1',items:db.users.map(out)};
    if(name==='crm_admin_reset_password_v1'){const t=db.users.find(u=>u.user_id===args.p_target_user_id);if(!t||!t.linked||!t.active)throw err('target not eligible');if(t.self)throw err('use self password change');t.must_change=true;return {ok:true,policy:'admin-password-reset-v1',target_user_id:t.user_id,target_name:t.name,must_change:true};}
    if(!db.v2)throw Object.assign(Error('Could not find the function'),{code:'PGRST202'});
    if(name==='crm_admin_create_account_v1'){const p=args.p;if(db.users.some(u=>u.email===p.email))throw err('email already used');
     let u;if(p.link_user_id){u=db.users.find(x=>x.user_id===p.link_user_id);if(!u||u.linked||!u.active)throw err('target not eligible');}
     else{if(db.users.some(x=>x.name===p.name))throw err('name already used');u=mk(20+db.users.length,p.name,p.kind==='admin'?'admin':p.kind==='dual'?'dual':'rep',null,null);db.users.push(u);}
     Object.assign(u,{email:p.email,linked:true,kind:p.kind,team:p.team,must_change:true,permission_role:p.kind==='branch'?'branch':(p.kind==='admin'||p.kind==='dual')?'admin':'rep'});
     return {ok:true,policy:'admin-account-create-v1',user_id:u.user_id,name:u.name,email:u.email,kind:p.kind,linked:!!p.link_user_id,must_change:true};}
    if(name==='crm_admin_set_active_v1'){const u=db.users.find(x=>x.user_id===args.p.user_id);if(!u)throw err('target not eligible');if(u.self)throw err('cannot change own account');u.active=args.p.active;return {ok:true,policy:'admin-account-active-v1',user_id:u.user_id,name:u.name,active:u.active};}
    throw Error('AUTH_REQUIRED');
   };
   const P=Object.assign({},real,{rpc});Object.defineProperty(P,'profile',{get:()=>window.__profile});window.Phase1=P;
   window.CRMRelease={has:()=>true,noteMissing(){},check(){},missing:()=>[]};
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';G.accountAdminV2Off=false;
  },v2);
  await seed(true);
  const dlg=page.locator('dialog.aa2'),rows=dlg.locator('.aa2-item'),row=n=>dlg.locator('.aa2-item',{has:page.locator('.aa2-who b',{hasText:new RegExp('^'+n+'$')})});
  const one=s=>String(s).replace(/\s+/g,' ').trim(),calls=n=>page.evaluate(n=>__db.calls.filter(c=>c[0]===n).map(c=>c[1]),n);

  /* 관리자만 */
  await page.evaluate(()=>{__profile.permission_role='rep';AccountAdmin.open();});await page.waitForTimeout(150);
  assert.equal(await page.locator('dialog.aa2,dialog.account-admin').count(),0,'영업사원에게는 열리지 않는다');
  await page.evaluate(()=>{__profile.permission_role='admin';AccountAdmin.open();});
  await rows.first().waitFor();

  /* 가운데 창 · 최대 880px */
  const box=await dlg.boundingBox();
  assert.equal(Math.round(box.width),880,'창 폭 880');
  assert.ok(Math.abs((box.x+box.width/2)-800)<=1,'가로 가운데 '+JSON.stringify(box));assert.ok(Math.abs((box.y+box.height/2)-500)<=1,'세로 가운데 '+JSON.stringify(box));
  assert.deepEqual(await dlg.evaluate(n=>{const s=getComputedStyle(n);return [s.borderTopLeftRadius,s.backgroundColor,n.querySelector('#aa2-title').textContent,getComputedStyle(n.querySelector('#aa2-title')).fontSize];}),['16px','rgb(255, 255, 255)','직원 계정 관리','18px']);
  assert.equal(await dlg.evaluate(n=>getComputedStyle(n).fontFamily===getComputedStyle(document.body).fontFamily),true,'CRM 본문 글꼴 그대로');
  assert.equal(await dlg.locator('.aa2-count').innerText(),'10명 · 로그인 연결 8명');
  assert.deepEqual((await dlg.locator('.aa2-tab').allInnerTexts()).map(one),['전체 10','관리자 1','대표 · 겸직 2','영업 · 팀장 5','지사 1']);
  assert.deepEqual(await dlg.locator('.aa2-tab').first().evaluate(b=>{const s=getComputedStyle(b);return [s.backgroundColor,s.color,s.borderRadius,s.fontSize,s.fontWeight];}),['rgb(21, 23, 28)','rgb(255, 255, 255)','999px','12.5px','700']);
  assert.equal(await dlg.locator('.aa2-search').getAttribute('placeholder'),'이름 · 이메일 검색');
  assert.deepEqual((await dlg.locator('.aa2-thead span').allInnerTexts()).map(one),['이름','역할','로그인 이메일','마지막 로그인','']);

  /* 한 줄 = 한 사람 · 10명이 한 화면(목록 안 스크롤 없음) */
  assert.equal(await rows.count(),10);
  assert.deepEqual(await dlg.locator('.aa2-list').evaluate(n=>[n.scrollHeight<=n.clientHeight,[...n.querySelectorAll('.aa2-row')].every(r=>Math.round(r.getBoundingClientRect().height)===52)]),[true,true],'10줄이 잘리지 않고 줄 높이 52');
  assert.equal(await dlg.locator('.aa2-row').first().evaluate(r=>getComputedStyle(r).gridTemplateColumns.split(' ').length),5);
  const cells=async n=>one(await row(n).locator('.aa2-row').innerText());
  assert.equal(await cells('송보람'),'송 송보람 영업관리 관리자 songboram@crm.netform.co.kr 2026.10.5 본인은 비밀번호 변경 사용');
  assert.equal(await row('송보람').locator('button').count(),0,'본인 줄에는 버튼이 없다');
  assert.equal(await cells('이승우'),'이 이승우 대표 대표 · 겸직 iseungwoo@crm.netform.co.kr 로그인 기록 없음 비밀번호 재설정 ···');
  assert.equal(await cells('황윤선'),'황 황윤선 본사 영업 · 상무 대표 · 겸직 hwangyunseon@crm.netform.co.kr 2026.10.4 비밀번호 재설정 ···');
  assert.equal(await cells('한준엽'),'한 한준엽 본사 영업 · 팀장 팀장 hanjunyeop@crm.netform.co.kr 2026.10.3 비밀번호 재설정 ···');
  assert.equal(await cells('이필선'),'이 이필선 본사 영업 영업사원 ipilseon@crm.netform.co.kr 2026.10.2 비밀번호 재설정 ···');
  assert.equal(await cells('조재연'),'조 조재연 B2B팀 · 협약문의 B2B 로그인 미연결 로그인 기록 없음 계정 연결 ···');
  assert.equal(await cells('경남지사'),'경 경남지사 경남지사 지사 로그인 미연결 로그인 기록 없음 계정 연결 ···');
  const css=(n,sel,props)=>row(n).locator(sel).first().evaluate((e,props)=>{const s=getComputedStyle(e);return props.map(p=>s[p]);},props);
  assert.deepEqual(await css('경남지사','.aa2-mail',['color']),['rgb(192, 57, 43)'],'미연결 = 주황');
  assert.deepEqual(await css('경남지사','[data-aa2="link"]',['backgroundColor','color']),['rgb(21, 23, 28)','rgb(255, 255, 255)'],'[계정 연결] = 검정');
  assert.deepEqual(await css('이필선','[data-aa2="reset"]',['backgroundColor','color','fontSize','fontWeight','borderRadius']),['rgb(255, 255, 255)','rgb(21, 23, 28)','12px','700','7px']);
  assert.deepEqual(await css('이승우','.aa2-last',['color']),['rgb(156, 163, 175)'],'로그인 기록 없음 = 회색');
  assert.deepEqual([await css('송보람','.aa2-tag',['color','backgroundColor']),await css('황윤선','.aa2-tag',['color','backgroundColor']),await css('한준엽','.aa2-tag',['color','backgroundColor']),await css('경남지사','.aa2-tag',['color','backgroundColor'])],
   [['rgb(29, 63, 153)','rgb(238, 243, 254)'],['rgb(112, 72, 232)','rgb(241, 237, 253)'],['rgb(31, 122, 77)','rgb(232, 246, 238)'],['rgb(192, 57, 43)','rgb(253, 236, 235)']]);
  assert.deepEqual(await css('송보람','.aa2-av',['width','height','borderRadius','backgroundColor']),['30px','30px','8px','rgb(21, 23, 28)']);
  assert.equal(one(await dlg.locator('.aa2-foot').innerText()),'본인 비밀번호는 오른쪽 위 내 이름 → 비밀번호 변경 · 퇴사자는 [···] → 비활성화(기록은 유지) 비활성 2명 보기');
  if(shot)await page.screenshot({path:shot.replace(/\.png$/,'-1-list.png')});

  /* 역할 알약 · 검색 */
  await dlg.locator('.aa2-tab',{hasText:'지사'}).click();assert.deepEqual(await dlg.locator('.aa2-who b').allInnerTexts(),['경남지사']);
  await dlg.locator('.aa2-tab',{hasText:'영업 · 팀장'}).click();assert.deepEqual(await dlg.locator('.aa2-who b').allInnerTexts(),['한준엽','이필선','정정훈','김성민','조현식']);
  await dlg.locator('.aa2-tab',{hasText:'전체'}).click();
  await dlg.locator('.aa2-search').fill('이필');assert.deepEqual(await dlg.locator('.aa2-who b').allInnerTexts(),['이필선']);
  await dlg.locator('.aa2-search').fill('hwang');assert.deepEqual(await dlg.locator('.aa2-who b').allInnerTexts(),['황윤선']);
  await dlg.locator('.aa2-search').fill('없는이름');assert.equal(one(await dlg.locator('.aa2-list').innerText()),'검색 결과가 없습니다.');
  await dlg.locator('.aa2-search').fill('');assert.equal(await rows.count(),10);

  /* 비밀번호 재설정: 확인 → 임시 비밀번호 */
  await row('이필선').locator('[data-aa2="reset"]').click();
  assert.equal(one(await row('이필선').locator('.aa2-panel').innerText()),'이필선의 지금 로그인이 바로 끊기고 임시 비밀번호가 만들어집니다. 재설정 이력은 서버에 남습니다. 취소 재설정하기');
  assert.deepEqual(await row('이필선').locator('[data-aa2="doReset"]').evaluate(b=>{const s=getComputedStyle(b);return [s.backgroundColor,s.color];}),['rgb(180, 35, 24)','rgb(255, 255, 255)']);
  assert.deepEqual(await row('이필선').locator('.aa2-panel').evaluate(p=>{const s=getComputedStyle(p);return [s.marginLeft,s.marginRight,s.backgroundColor,s.borderRadius];}),['62px','22px','rgb(248, 249, 251)','10px']);
  await row('이필선').locator('[data-aa2="cancel"]').click();assert.equal(await dlg.locator('.aa2-panel').count(),0);assert.equal((await calls('crm_admin_reset_password_v1')).length,0,'취소하면 아무것도 보내지 않는다');
  await row('이필선').locator('[data-aa2="reset"]').click();await row('이필선').locator('[data-aa2="doReset"]').click();
  await row('이필선').locator('.aa2-pw').waitFor();
  const sent=(await calls('crm_admin_reset_password_v1'))[0],shown=await row('이필선').locator('.aa2-pw').innerText();
  assert.equal(sent.p_target_user_id,'00000000-0000-4000-8000-000000000005');assert.match(sent.p_new_password,PW);assert.equal(shown,sent.p_new_password,'보낸 임시 비밀번호 = 화면에 보여 준 것');
  assert.equal(one(await row('이필선').locator('.aa2-panel').innerText()),'임시 비밀번호 '+shown+" 복사 닫기 이 창을 닫으면 다시 볼 수 없습니다 · 직원에게 전달하고 로그인 후 '비밀번호 변경'을 안내하세요");
  assert.match(await row('이필선').locator('.aa2-pw').evaluate(b=>getComputedStyle(b).fontFamily),/monospace/);
  await row('이필선').locator('[data-aa2="copy"]').click();await page.waitForFunction(()=>[...document.querySelectorAll('dialog.aa2 [data-aa2="copy"]')].some(b=>b.textContent==='복사됨'));
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),shown);
  if(shot)await page.screenshot({path:shot.replace(/\.png$/,'-2-issued.png')});
  await row('이필선').locator('[data-aa2="cancel"]').click();assert.equal(await dlg.locator('.aa2-panel').count(),0);
  assert.equal(await row('이필선').locator('.aa2-act .aa2-btn').innerText(),'임시 비밀번호 보기');
  await row('이필선').locator('[data-aa2="show"]').click();assert.equal(await row('이필선').locator('.aa2-pw').innerText(),shown);
  await row('이필선').locator('[data-aa2="cancel"]').click();

  /* 계정 추가 */
  await dlg.locator('[data-aa2="add"]').click();
  const add=dlg.locator('.aa2-add');
  assert.equal(one(await add.innerText()).replace(/영업사원 팀장 지사 관리자 대표 · 겸직|본사 영업 경남지사 B2B/g,'').replace(/\s+/g,' '),'새 계정 이름 * 이메일 * 역할 * 소속 만들면 임시 비밀번호가 나옵니다 · 첫 로그인 때 비밀번호 변경 강제 취소 계정 만들기');
  assert.deepEqual(await add.locator('select').evaluateAll(l=>l.map(s=>[...s.options].map(o=>o.textContent))),[['영업사원','팀장','지사','관리자','대표 · 겸직'],['본사 영업','경남지사','B2B']]);
  assert.deepEqual(await add.evaluate(n=>{const s=getComputedStyle(n),g=getComputedStyle(n.querySelector('.aa2-fields'));return [s.backgroundColor,g.gridTemplateColumns.split(' ').length];}),['rgb(248, 249, 251)',4]);
  await add.locator('[data-aa2="create"]').click();assert.equal(await add.locator('.aa2-addnote').innerText(),'이름을 입력해 주세요.');
  await add.locator('[data-aa2-f="name"]').fill('박지훈');await add.locator('[data-aa2-f="email"]').fill('parkjihoon');await add.locator('[data-aa2="create"]').click();
  assert.equal(await add.locator('.aa2-addnote').innerText(),'이메일 주소를 확인해 주세요.');assert.equal(await add.locator('[data-aa2-f="name"]').inputValue(),'박지훈','오류가 나도 입력은 남는다');
  await add.locator('[data-aa2-f="email"]').fill('ipilseon@crm.netform.co.kr');await add.locator('[data-aa2="create"]').click();
  await page.waitForFunction(()=>document.querySelector('dialog.aa2 .aa2-addnote').textContent==='이미 쓰고 있는 이메일입니다.');
  await add.locator('[data-aa2-f="email"]').fill('ParkJihoon@crm.netform.co.kr');await add.locator('[data-aa2-f="kind"]').selectOption('branch');await add.locator('[data-aa2-f="team"]').selectOption('경남지사');
  await add.locator('[data-aa2="create"]').click();await row('박지훈').locator('.aa2-pw').waitFor();
  const made=(await calls('crm_admin_create_account_v1')).at(-1).p;
  assert.deepEqual([made.name,made.email,made.kind,made.team,made.link_user_id],['박지훈','parkjihoon@crm.netform.co.kr','branch','경남지사',undefined]);assert.match(made.temp_password,PW);
  assert.equal(await row('박지훈').locator('.aa2-pw').innerText(),made.temp_password);
  assert.equal(await add.isHidden(),true,'폼은 닫힌다');assert.equal(await dlg.locator('.aa2-count').innerText(),'11명 · 로그인 연결 9명');
  assert.equal(one(await row('박지훈').locator('.aa2-row').innerText()),'박 박지훈 경남지사 지사 parkjihoon@crm.netform.co.kr 방금 만듦 · 첫 로그인 전 임시 비밀번호 보기 ···');
  assert.equal(one(await row('박지훈').locator('[data-aa2-loginhint]').innerText()),'로그인 화면의 이름 칸에 이메일 parkjihoon@crm.netform.co.kr 을 넣어 로그인합니다');
  assert.deepEqual((await dlg.locator('.aa2-tab').allInnerTexts()).map(one),['전체 11','관리자 1','대표 · 겸직 2','영업 · 팀장 5','지사 2']);
  if(shot)await page.screenshot({path:shot.replace(/\.png$/,'-3-added.png')});
  await row('박지훈').locator('[data-aa2="cancel"]').click();

  /* 계정 연결: 이름 · 소속 미리 채움 · 이름은 못 바꿈 · 이름 명단의 이메일 그대로 */
  await row('경남지사').locator('[data-aa2="link"]').click();
  assert.equal(await add.locator('.aa2-addt').innerText(),'계정 연결 · 경남지사');
  assert.deepEqual(await add.evaluate(n=>[...n.querySelectorAll('[data-aa2-f]')].map(f=>[f.value,f.readOnly===true])),[['경남지사',true],['gyeongnam@crm.netform.co.kr',true],['branch',false],['경남지사',false]]);
  if(shot)await page.screenshot({path:shot.replace(/\.png$/,'-4-link.png')});
  await add.locator('[data-aa2="create"]').click();await row('경남지사').locator('.aa2-pw').waitFor();
  const linked=(await calls('crm_admin_create_account_v1')).at(-1).p;
  assert.deepEqual([linked.name,linked.email,linked.kind,linked.team,linked.link_user_id],['경남지사','gyeongnam@crm.netform.co.kr','branch','경남지사','00000000-0000-4000-8000-000000000010']);
  assert.equal(await row('경남지사').locator('[data-aa2-loginhint]').count(),0,'이름 명단에 있는 계정은 이름으로 로그인');
  assert.equal(await row('경남지사').locator('.aa2-mail').innerText(),'gyeongnam@crm.netform.co.kr');assert.equal(await dlg.locator('.aa2-count').innerText(),'11명 · 로그인 연결 10명');
  await row('경남지사').locator('[data-aa2="cancel"]').click();
  await row('조재연').locator('[data-aa2="link"]').click();
  assert.deepEqual(await add.evaluate(n=>[...n.querySelectorAll('[data-aa2-f]')].map(f=>f.value)),['조재연','jojaeyeon@crm.netform.co.kr','rep','B2B']);
  await add.locator('[data-aa2="addCancel"]').click();assert.equal(await add.isHidden(),true);

  /* [···] 비활성화: 삭제가 아니다 · 비활성 목록에서 다시 활성화 */
  await row('김성민').locator('[data-aa2="more"]').click();
  assert.equal(one(await row('김성민').locator('.aa2-panel').innerText()),'김성민 계정을 비활성화합니다. 지금 로그인이 바로 끊기고 다시 로그인할 수 없습니다. 기록과 실적 귀속은 그대로 남습니다(삭제하지 않음). 취소 비활성화');
  await row('김성민').locator('[data-aa2="doOff"]').click();await page.waitForFunction(()=>![...document.querySelectorAll('dialog.aa2 .aa2-who b')].some(b=>b.textContent==='김성민'));
  assert.deepEqual((await calls('crm_admin_set_active_v1')).at(-1),{p:{user_id:'00000000-0000-4000-8000-000000000007',active:false}});
  assert.equal(await dlg.locator('.aa2-count').innerText(),'10명 · 로그인 연결 9명');assert.equal(await dlg.locator('[data-aa2="toggleOff"]').innerText(),'비활성 3명 보기');
  await dlg.locator('[data-aa2="toggleOff"]').click();
  assert.equal(await rows.count(),13);assert.equal(one(await row('김성민').locator('.aa2-row').innerText()),'김 김성민 비활성 영업사원 kimseongmin@crm.netform.co.kr 로그인 기록 없음 다시 활성화');
  await row('김성민').locator('[data-aa2="on"]').click();await row('김성민').locator('[data-aa2="doOn"]').click();
  await page.waitForFunction(()=>document.querySelector('dialog.aa2 [data-aa2="toggleOff"]').textContent==='비활성 숨기기'&&document.querySelectorAll('dialog.aa2 .aa2-item.off').length===2);
  assert.equal(await page.evaluate(()=>__db.users.length),13,'직원 줄은 지워지지 않는다');
  await dlg.locator('[data-aa2="toggleOff"]').click();assert.equal(await rows.count(),11);

  /* 창을 닫으면 임시 비밀번호는 다시 볼 수 없다 */
  await dlg.locator('[data-aa2="close"]').click();await dlg.waitFor({state:'detached'});
  await page.evaluate(()=>AccountAdmin.open());await rows.first().waitFor();
  assert.equal(await row('이필선').locator('.aa2-act .aa2-btn').innerText(),'비밀번호 재설정');assert.equal(await row('박지훈').locator('.aa2-act .aa2-btn').innerText(),'비밀번호 재설정');
  await page.keyboard.press('Escape');await dlg.waitFor({state:'detached'});

  /* 좁은 화면(1207×914)에서도 가운데 · 화면 안 */
  await page.setViewportSize({width:1207,height:914});await page.evaluate(()=>AccountAdmin.open());await rows.first().waitFor();
  const b2=await dlg.boundingBox();assert.ok(Math.abs((b2.x+b2.width/2)-603.5)<=1&&b2.y>=24&&b2.y+b2.height<=914-24,'1207×914 '+JSON.stringify(b2));
  await page.keyboard.press('Escape');await dlg.waitFor({state:'detached'});await page.setViewportSize({width:1600,height:1000});

  /* 서버 함수 설치 전: 추가 · 연결 · 비활성화는 잠기고 재설정은 그대로 된다 */
  await seed(false);await page.evaluate(()=>AccountAdmin.open());await rows.first().waitFor();
  assert.deepEqual(await dlg.evaluate(n=>[n.querySelector('[data-aa2="add"]').disabled,n.querySelector('[data-aa2="add"]').title,[...n.querySelectorAll('[data-aa2="link"]')].every(b=>b.disabled),[...n.querySelectorAll('[data-aa2="more"]')].every(b=>b.disabled)]),[true,'서버 적용 뒤에 열립니다',true,true]);
  assert.equal(await cells('조재연'),'조 조재연 B2B팀 · 협약문의 B2B 로그인 미연결 로그인 기록 없음 계정 연결 ···');
  await row('정정훈').locator('[data-aa2="reset"]').click();await row('정정훈').locator('[data-aa2="doReset"]').click();await row('정정훈').locator('.aa2-pw').waitFor();
  assert.match(await row('정정훈').locator('.aa2-pw').innerText(),PW);
  await page.keyboard.press('Escape');await dlg.waitFor({state:'detached'});

  /* 끄면 예전 창 */
  await page.evaluate(()=>{G.accountAdminV2Off=true;AccountAdmin.open();});await page.locator('dialog.account-admin .aa-row').first().waitFor();
  assert.equal(await page.locator('dialog.aa2').count(),0);await page.locator('dialog.account-admin [data-aa-close]').click();await page.locator('dialog.account-admin').waitFor({state:'detached'});await page.evaluate(()=>{G.accountAdminV2Off=false;});

  /* 첫 로그인 변경 강제 */
  await page.evaluate(()=>{window.__must=false;window.SB={auth:{getUser:async()=>({data:{user:{id:'u-admin'}}}),updateUser:async p=>{(window.__pw=window.__pw||[]).push(p);return {data:{user:{id:'u-admin'}}};}}};return CRMPassword.checkForced();});
  assert.equal(await page.locator('dialog.account-password').count(),0,'바꿀 것이 없으면 뜨지 않는다');
  await page.evaluate(()=>{window.__must='missing';return CRMPassword.checkForced();});assert.equal(await page.locator('dialog.account-password').count(),0,'서버 함수가 없어도 로그인은 막지 않는다');
  await page.evaluate(()=>{window.__must=true;window.__signout=0;window.authSignOut=()=>{window.__signout++;};return CRMPassword.checkForced();});
  const fd=page.locator('dialog.account-password-force');await fd.waitFor();
  assert.equal(await fd.locator('h2').innerText(),'비밀번호를 먼저 바꿔 주세요');assert.match(await fd.locator('p').first().innerText(),/임시 비밀번호로 로그인했습니다/);
  await page.keyboard.press('Escape');await page.waitForTimeout(100);assert.equal(await fd.count(),1,'Esc 로 닫히지 않는다');
  assert.equal(await fd.locator('.account-password-actions button[type=button]').innerText(),'로그아웃');
  await fd.locator('.account-password-actions button[type=button]').click();assert.equal(await page.evaluate(()=>__signout),1,'바꾸지 않고 나가는 길은 로그아웃뿐');assert.equal(await fd.count(),1);
  await fd.getByLabel('현재 비밀번호',{exact:true}).fill('NF-ABCD-EFGH');await fd.getByLabel('새 비밀번호',{exact:true}).fill('my-own-long-password');await fd.getByLabel('새 비밀번호 확인',{exact:true}).fill('my-own-long-password');
  const before=(await calls('crm_my_credential_state_v1')).length;
  await fd.locator('button[type=submit]').click();await fd.getByRole('status').filter({hasText:'비밀번호를 변경했습니다'}).waitFor();
  assert.deepEqual(await page.evaluate(()=>__pw.at(-1)),{password:'my-own-long-password',current_password:'NF-ABCD-EFGH'});
  assert.equal((await calls('crm_my_credential_state_v1')).length,before+1,'바꾼 뒤 서버에 다시 확인해 표시를 푼다');
  await fd.getByRole('button',{name:'닫기',exact:true}).click();await fd.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>__signout),1);

  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('account admin v2 ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
