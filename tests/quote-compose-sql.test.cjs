'use strict';
/* 공법견적 서버 함수 약속 (2026-10-11 견적 v3 6단계) — SQL · 전송 허용 목록 · 화면이 같은 이름 · 같은 규칙 (JS 와 서버 계산이 칸마다 같은지는 PGlite 로 따로 확인) */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/\r\n/g,'\n');
const s6=read('sql/quote-v3-step6-20261011.sql'),s5=read('sql/quote-v3-step5-20261011.sql');
test('step5: 공법 기준(method)도 같은 흐름 — 초안 · 출처 확인 · 승인',()=>{
 assert.match(s5,/kind in \('labor','cost','material','method'\)/);assert.match(s5,/insert into public\.crm_method_specs\(method,composition,effective_from,status,source,created_by\)/);
 assert.match(s5,/update public\.crm_method_specs set status='active'/);assert.match(s5,/'method',v_met/);
});
test('step6: 계산은 읽기 전용 · 저장은 새 수정본(덮어쓰기 없음) · 화면 계산과 다르면 거절 · 서버의 오늘 날짜 · 종료 건 거절',()=>{
 assert.match(s6,/create or replace function public\.crm_quote_compose_v1\(p jsonb\)\s*returns jsonb language plpgsql stable security definer/);
 assert.match(s6,/a\.permission_role not in \('rep','branch','admin'\)/);assert.match(s6,/crm_security\.can_deal\(v_id,true\)/);
 assert.match(s6,/crm_quote_compose_v1\(p - 'date'\)/,'저장할 때 견적일은 서버의 오늘');assert.match(s6,/v_base::bigint<>v_expected[\s\S]*PT409/);
 assert.match(s6,/insert into crm_security\.quote_versions\(deal_id,version_no,amount,reason,actor_auth_uid,actor_user_id,created_at,kind,base_amount,supply_amount,status,basis,markup_note\)/);
 assert.doesNotMatch(s6,/update crm_security\.quote_versions/);assert.match(s6,/종료된 영업건은 견적을 저장할 수 없습니다/);
 assert.match(s6,/ceil\(round\(mrow\.unit_price\/coalesce\(nullif\(m#>>'\{ref,divisor\}',''\)::numeric,1\),6\)\/100\)\*100/,'자재 단가 100원 단위 올림');
 for(const n of ['crm_quote_compose_v1','crm_quote_version_save_v1']){assert.match(s6,new RegExp('revoke all on function public\\.'+n+'\\(jsonb\\) from public, anon;'));assert.match(s6,new RegExp('grant execute on function public\\.'+n+'\\(jsonb\\) to authenticated;'));}
});
test('전송 허용 목록 · 오류 이름 · 화면 호출 · 상세 연결',()=>{
 const tr=read('pc-manager-transport.js'),er=read('pc-error-state.js'),c=read('quote-composer.js'),d=read('deal-detail-v3.js'),h=read('crm.html');
 for(const n of ['crm_quote_compose_v1','crm_quote_version_save_v1']){assert.match(tr,new RegExp("'"+n+"'"));assert.match(er,new RegExp(n+":'"));}
 assert.match(c,/sb\.rpc\('crm_quote_version_save_v1'/);assert.match(c,/expected_base:base/);assert.match(d,/data-v=\"compose\">견적 작성/);assert.match(d,/openP7\('quote'\)/);assert.match(d,/QuoteComposer\.mount\(qh,d\)/);
 assert.match(read('deal-frame7.js'),/quote:\['견적 작성'/);assert.match(read('deal-frame7.css'),/data-p="quote"\] \.dv7-pbody>\.dv7-fill\{display:block!important\}/);
 assert.match(h,/quote-calc\.js\?v=\w+"><\/script><script src="\.\/quote-compose\.js[^>]*><\/script><script src="\.\/quote-composer\.js/);
});
