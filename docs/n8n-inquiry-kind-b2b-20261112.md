# 잔디 「문의 성격: 공사 견적 / B2B」 → CRM (2026-11-12)

## 결론
- 잔디 배정 · 응대 페이지에서 **B2B**를 고르면 CRM 문의도 「협약문의 · B2B」로 바뀌고, 잔디 응대 저장으로 **파이프라인 영업건을 만들지 않는다**. **견적**으로 돌리면 원래대로.
- CRM 받는 쪽: `sql/inquiry-external-kind-b2b-v1-20261112.sql` (되돌리기 `…-rollback.sql`). **운영 반영은 대표님 확인 뒤.**
- n8n: 동기화 칸 2개의 p_event 끝에 `inquiry_kind` 한 칸. **적용도 대표님 확인 뒤.** 순서는 CRM 먼저가 좋지만, n8n을 먼저 바꿔도 CRM이 모르는 칸을 무시할 뿐 깨지지 않는다.

## 변경 전 → 후

| | 변경 전 | 변경 후 |
|---|---|---|
| 잔디에서 B2B 선택 | 시트 공사유형만 「협약/B2B · 」. CRM은 견적문의 그대로(시트→CRM 동기화는 기존 문의를 안 바꾸고, 배정 · 응대 이벤트엔 공사유형이 없음) | CRM `work_type` · raw 공사유형 앞에도 「협약/B2B · 」, raw 문의성격 = B2B → 화면 협약 판정(isAgreement)이 B2B로 봄 |
| 견적으로 다시 선택 | — | 잔디가 붙인 「협약/B2B · 」만 뗌, 문의성격 = 견적 |
| B2B 건 응대 저장(전화응대 완료 등) | 11/10부터 응대 상태면 영업건 자동 생성 | 영업건 안 만듦(reason `B2B_NO_PIPELINE`, 전환 검토로도 안 남김) |
| B2B + 견적 보낸 날 | — | 받지 않음(`QUOTE_ON_B2B`) |
| 원래 공사유형에 '협약'이 있던 예전 문의 | 잔디 응대로 영업건이 생길 수 있었음 | 영업건 안 만듦. 잔디에서 「견적」을 고르면 넘어감 |

바뀔 때만 쓰고 문의 감사 기록(`flow_field_set`, field `inquiry_kind`, before/after)을 남긴다. 전환 · 종결 문의는 기존 규칙대로 안 건드린다. 과거 소급 없음.

## SQL이 하는 일
- 새 함수(서비스 키 전용): `private.inquiry_external_kind_validate_v1` · `private.inquiry_external_kind_apply_v1` · `private.inquiry_is_b2b_v1`
- 운영 함수 4곳에 **한 줄씩(줄바꿈 없이)** 덧붙임: enqueue(받기 전 검사) · apply(배정/응대 처리 직전) · `promote_v1` · `promote_v2`(영업건 만들기 직전 B2B면 멈춤). 넷 다 기준 문장이 정확히 1곳일 때만 바꾸고, 하나라도 다르면 아무것도 안 바꾼다.
- 먼저 있어야 하는 것: #738 마이그레이션 · `sql/inquiry-external-promote-on-contact-v1-20261110.sql`
- 시험: `node --test tests/inquiry-external-kind-b2b.test.cjs` (PGlite 6개 — #738 → 11/10 → 이번 순서로 깔고 B2B/견적 전환 · 영업건 막기 · 배정 이벤트 · 잘못된 값 거부 · 되돌리기 후 본문 원래대로 · 본문 다르면 멈춤)

## n8n 변경안 (「견적문의 담당자 배정」 rXU5jbSUlNRz11KN, 11/12 다른 세션이 `kind` 출력을 넣은 뒤 기준)
1. **Supabase 최초응대 동기화** · p_event 끝
   - 전: `…, contact_result: d.contactResult || null, quote_sent_on: d.quoteSentOn || null, quote_amount: d.quoteAmount ?? null }; })() }}`
   - 후: `…, contact_result: d.contactResult || null, quote_sent_on: d.kind === 'B2B' ? null : (d.quoteSentOn || null), quote_amount: d.kind === 'B2B' ? null : (d.quoteAmount ?? null), inquiry_kind: ['견적','B2B'].includes(d.kind) ? d.kind : null }; })() }}`
   - B2B일 때 견적 칸 값이 남아 있어도 보내지 않게 해 `QUOTE_ON_B2B` 오류를 미리 막는다.
2. **Supabase 담당자 동기화** · p_event 끝
   - 전: `…, sheet_row: $('해당 행 찾기').first().json.rowNumber } }}`
   - 후: `…, sheet_row: $('해당 행 찾기').first().json.rowNumber, inquiry_kind: ['견적','B2B'].includes($('데이터 추출').first().json.kind) ? $('데이터 추출').first().json.kind : null } }}`
3. (확인 필요) 담당자 **변경**(재배정) 경로도 CRM에 보내는 칸이 따로 있으면 같은 한 칸을 넣는다.

## 시험 (시험 문의 1건 · 고객 아님, 잔디 글이 나가므로 보람님 확인 뒤)
1. 배정 페이지에서 B2B로 배정 → CRM 문의 공사유형 「협약/B2B · …」, 화면에 협약문의로 보임.
2. 응대 페이지 B2B · 전화응대 완료 저장 → 영업건 안 생김.
3. 응대 페이지 견적으로 바꿔 저장 → 「협약/B2B · 」 떨어지고, 응대 상태면 '컨설팅 설계' 영업건 생김.
4. 정리: 시험 영업건 · 문의 휴지통, 시트 행 · 잔디 글 삭제. 되돌리기: n8n 버전 기록 · CRM `…-rollback.sql`.

## 남는 것
- CRM 화면 협약 판정은 문의내용 글도 본다(「협약 문의」라고 적힌 건). 그런 건은 잔디에서 견적을 골라도 화면엔 B2B로 보일 수 있다(서버는 견적으로 처리). 화면 읽기에 문의성격 칸을 넘기는 건 다음 작업.
- B2B 응대 페이지의 「자료 · 협약서 보낸 날」은 지금처럼 다음 날짜(+7일)로만 CRM에 간다. 따로 칸으로 남기려면 다음 작업.
