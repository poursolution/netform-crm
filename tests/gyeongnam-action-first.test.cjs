'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');

test('경남지사 A+B: 퍼널 → 미처리 듀오 → 인계 원장 → 담당자 흐름 순서를 render가 고정한다',()=>{
 const paint=html.slice(html.indexOf('function paintGyeongnam('));
 const funnel=paint.indexOf('gnFunnel2(X,named,responded)');
 const duo=paint.indexOf('gnDuo(X)');
 const ledger=paint.indexOf("gnFrame('본사 인계 원장'");
 const flow=paint.indexOf("gnFrame('경남지사 담당자별 흐름'");
 assert.ok(funnel>0&&duo>funnel&&ledger>duo&&flow>ledger,'funnel-first order is fixed in render itself');
 // 큰 명령부·KPI 타일 줄 없이 퍼널이 KPI이자 내비게이션이다.
 assert.doesNotMatch(html,/GYEONGNAM BRANCH CONTROL/);
 assert.doesNotMatch(html,/gn-kpiline/);
 assert.match(html,/class="gn2-funnel"/);
 const workspace=fs.readFileSync(path.join(__dirname,'..','detail-workspace.js'),'utf8');
 assert.doesNotMatch(workspace,/frames\.forEach\([^\n]+fold\(n/);
 assert.match(workspace,/branch\.classList\.add\('dw-branch-visible'\)/);
});

test('실담당 지정과 최초응대 근거 동선은 그대로 유지한다',()=>{
 assert.match(html,/function gnOpenOwner\(i\)/);
 assert.match(html,/function gnConfirmOwner\(\)/);
 assert.match(html,/function gnShow\(kind,rep\)/);
 assert.match(html,/실담당 미지정/);
 assert.match(html,/최초응대 대기/);
});
