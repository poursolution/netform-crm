'use strict';
// Phase 1 evidence updates only. Business rows F07+ and approved overlays stay unchanged.
module.exports={
 F02:{status:'TEST_MISSING',v2:'crm_profile_scoped_v2 + original PC/mobile copy auth adapter',gap:'원본 복제본 + 실제 JWT JSDOM 12/12. 실제 브라우저 로그인/승인거부/이름변경 회귀 미완료. 비밀번호 숫자 강제 변환 제거. PC overlay 파일2개 누락.'},
 F03:{status:'TEST_MISSING',v2:'Staging/ref/Auth UID/v1 isolated session and app storage',gap:'JSDOM 실제 JWT 세션복원/로그아웃 및 로컬 계정교체 캐시/큐 제거 PASS. 실제 브라우저 refresh 만료/계정교체/다중탭은 미검증.'},
 F04:{status:'TEST_MISSING',v2:'server source_role + permission_role + allowed_modes; mobile original mode controls',gap:'6계정 실제 JWT 매핑 및 JSDOM 관리/내 영업 전환 PASS. dual 실제 계정 없음; PC 역할별 홈/브라우저 회귀 미완료. 모드는 서버 scope를 확대하지 않음.'},
 F05:{status:'CONTRACT_MISSING',v2:'Phase1.read(resource,args): complete/partial/unavailable envelope; target work_items reader',gap:'Phase1 공통 contract 준비. 전체 B bundle을 만들지 않음. 업무별 reader/전체필드/자동동기화/진단은 후속 Phase 대상이며 아직 unavailable.'},
 F06:{status:'CONTRACT_MISSING',v2:'crm_write_command_v2(uuid,text,uuid,integer,jsonb) + private receipts + isolated queue',gap:'공종용 공통 ACK/멱등성/409 실제 Staging PASS. 기존 업무 handler는 expected_version 전달이 없어 fail-closed; 업무별 UI binding/신규 UUID 생성 계약은 미완료. 거짓 전체 Parity PASS 금지.'}
};
