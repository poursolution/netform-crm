'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');

test('경남지사는 미처리와 본사 인계 목록을 분석보다 먼저 배치한다',()=>{
 assert.match(html,/var _paintGyeongnamActionFirst=paintGyeongnam/);
 assert.match(html,/\['즉시 확인','본사 인계 현황','경남지사 담당자별 흐름','본사 → 경남지사 영업 Funnel','최근 6개월 흐름'\]/);
 assert.match(html,/root\.classList\.add\('gn-action-first'\)/);
});

test('실담당 지정과 최초응대 근거 동선은 그대로 유지한다',()=>{
 assert.match(html,/function gnOpenOwner\(i\)/);
 assert.match(html,/function gnConfirmOwner\(\)/);
 assert.match(html,/function gnShow\(kind,rep\)/);
 assert.match(html,/담당자 미지정/);
 assert.match(html,/최초응대 지연/);
});
