'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');

test('경남지사는 본사 인계 현황을 분석(Funnel·추이)보다 먼저 배치한다',()=>{
 const handoff=html.indexOf("gnFrame('본사 인계 현황'");
 const flow=html.indexOf("gnFrame('경남지사 담당자별 흐름'");
 const funnel=html.indexOf("gnFrame('본사 → 경남지사 영업 Funnel'");
 const trend=html.indexOf("gnFrame('최근 6개월 흐름'");
 assert.ok(handoff>0&&flow>0&&funnel>0&&trend>0,'four frames rendered');
 assert.ok(handoff<flow&&flow<funnel&&funnel<trend,'handoff-first order is fixed in render itself');
 // 상단은 파이프라인 문법: 큰 명령부 대신 클릭 드릴이 되는 KPI 한 줄.
 assert.match(html,/class="ps-kpis gn-kpiline"/);
 assert.doesNotMatch(html,/GYEONGNAM BRANCH CONTROL/);
 const workspace=fs.readFileSync(path.join(__dirname,'..','detail-workspace.js'),'utf8');
 assert.doesNotMatch(workspace,/frames\.forEach\([^\n]+fold\(n/);
 assert.match(workspace,/branch\.classList\.add\('dw-branch-visible'\)/);
});

test('실담당 지정과 최초응대 근거 동선은 그대로 유지한다',()=>{
 assert.match(html,/function gnOpenOwner\(i\)/);
 assert.match(html,/function gnConfirmOwner\(\)/);
 assert.match(html,/function gnShow\(kind,rep\)/);
 assert.match(html,/담당자 미지정/);
 assert.match(html,/최초응대 대기/);
});
