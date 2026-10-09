# Claude 결정 — '이관 기록 확인 필요' 문의의 표시 위치 (2026-10-09)

답하는 문서: `docs/CLAUDE_INQUIRY_CONTACT_REVIEW_20261009.md` (PR #534 · `codex/inquiry-memo-followup-20261009`).
역할 분담(대표 지시 2026-10-04): 화면 · 시안 = Claude, 서버 · 데이터 · 로직 연결 = Codex. 이 문서는 결정과 연결 위치만 적는다. 코드 · SQL 은 바꾸지 않았다.

## 한 줄 결정

'이관 기록 확인 필요' 문의는 **견적문의 목록 v4 의 다섯째 상태 칸(지금 이름 '연락처 보완' · `st 5`)** 에 넣는다. **새 탭 · 새 배치 · 새 색 없음.**
칸 이름만 **'기록 보완'** 으로 넓히고, 설명은 지금 문구 그대로 '연락처 찾기 · 이관 기록 확인'. 줄의 상태 꼬리표는 사유별로 **'연락처 보완' / '이관 기록 확인'**. 급한 순 묶음은 **④ 과거 기록 정리**, 기한 없음, 회색.

근거
- 다섯째 탭 설명이 이미 '연락처 찾기 · 이관 기록 확인'이고(`inquiry-v4.js` TABS), 상세의 보완 블록 제목도 '연락처 보완 · 이관 기록 확인'(`inquiry-memo.js` findHtml). 디자인이 이미 두 사유를 한 칸으로 묶어 두었다.
- 두 사유 모두 '정리하기 전에는 첫 연락 · 후속을 판정할 수 없는 과거 기록'이라 ④ 묶음 · 회색 · 기한 없음이 같다.
- '전체 = 뒤 다섯 칸의 합' 규칙이 칸 수 변화 없이 유지된다.
- 연락처가 있는 고객을 '연락처 보완'이라 부르지 않으려고 칸 이름만 넓힌다(인수인계 조건 1).

디자인 쪽이 '기록 보완' 이름 변경을 받지 않으면 대안은 여섯째 칸 '이관 기록 확인'(회색 · ④ · 연락처 보완 오른쪽). 그 경우도 아래 판정 규칙 · 화면별 연결은 같고 `ST[6]` 하나만 는다.

## 판정 규칙 — 한 곳에서

판정은 **`InquiryListV3.model`** 에 둔다. 목록 v4(`ext`), KPI v7(`stageGroups`), 끄기 뒤 v3 · v2 가 모두 이 model 을 읽는다. model 에 `review` 필드를 추가한다.

```
review = InquiryMemo.contactReview(q).required 이고, 아래 셋 모두 아닐 때
 (a) 담당 미지정(step 0)                       → 배정 필요가 우선(조건 2)
 (b) InquiryFlow 연결 기록(logs kind 'connected')이 하나라도 있음
     → copied_received_date 라도 그 뒤 실제 연결이 있으면 검토 대상 아님
 (c) 영업건 전환 · 기존 영업건 붙임(step 4)
review = {required, reason:'memo_call_unconfirmed'|'copied_received_date', candidateDate, undated}
```

- `step` 은 바꾸지 않는다(연결 없음 = 1, 접수일 복사 = 2 그대로). `late` 는 review 면 false, `elapsed` 는 '—', `act` 는 '기록 확인'. 수백 일짜리 새 지연 평가를 만들지 않는다(조건 4).
- 메모 후보로 실제 연결일 · 첫 연락 · 후속 완료 · 성과를 자동 확정하지 않는다(조건 2).

v4 `ext()` 우선순위(지금 순서에 review 한 줄만 끼운다)

```
연락처 없음(noPhone) → st 5 · 연락처 보완
step 0                 → st 1 · 배정 필요
review                 → st 5 · 이관 기록 확인
step 1                 → st 2 · 첫 연락 전
후속 · 지남 / 정상       → st 3 / st 4
```

연락처 없음 + 검토 필요 = '연락처 보완'(번호가 있어야 확인 전화를 할 수 있다). 연락처 있음 + 검토 필요 = '이관 기록 확인'.

## 화면별 연결 위치

1. **목록 v4 (`inquiry-v4.js`)**
   - `ST[5]` 탭 라벨 '기록 보완', 줄 꼬리표 `stLabel` 은 사유별('연락처 보완' / '이관 기록 확인'). 탭 설명은 그대로.
   - `ext()` 위 우선순위, `g = 4`.
   - `lines()` l1 '④ 과거 기록 정리', l3 '기한 없음', 색 `#6b7280`. l2 는 사유별
     - `memo_call_unconfirmed` + 날짜: `이관 기록 확인 필요 · 메모에 1.16 통화 후보`
     - `memo_call_unconfirmed` 날짜 없음: `이관 기록 확인 필요 · 날짜 없는 통화 후보`
     - `copied_received_date`: `실제 연결일이 접수일 복사 · 확인 필요`(지금 copyText 와 같은 결)
   - 탭 건수: 전체 = 배정 필요 + 첫 연락 전 + 후속 연락 필요 + 정상 진행 + 기록 보완. 기록 보완 탭 title(툴팁)에 '연락처 없음 n · 이관 기록 확인 n'.
   - 상세 `memoBlocks`: st 5 이고 사유가 review 면 findHtml(번호 찾기) 대신 datesHtml + memoHtml 을 맨 위에. 누르는 것은 이미 있는 [M.D 통화로 실제 연결일 보완] 과 기존 응대 기록 저장 두 가지뿐.
   - 정렬: ④ 안에서 마지막 실제 연결 오래된 순. 후보 날짜 없는 줄은 ④ 맨 뒤.
2. **v4 끄기 → v3 · v2 (`inquiry-list-v3.js`, `inquiry-list-v2.js`)**: v3 는 model.review 로 꼬리표 '첫 연락 전 · 이관 기록 확인 필요'(회색, 빨강 아님) · 경과 '—' · act '기록 확인'. v2 는 group 그대로, cta '기록 확인'.
3. **전체 상세 (`inquiry-detail-v2.js` `stateOf`)**: step 그대로. review 면 pill `['amb','이관 기록 확인 필요 · 메모에 1.16 통화 후보']`(빨강 아님 · 경과 없음), basis 문장 '이관 메모의 통화 후보를 확인 — 실제 연결일 보완 또는 새 연락 기록 뒤에 첫 연락 기준으로 돌아감', 오른쪽 title '이관 기록 확인'(지금 '첫 연락 전화' 자리).
4. **오늘 업무 (`today-work-queue.js` · `crm.html inquiryResponseLate`)**: review 는 '첫 연락 늦음'이 아니다. 제외는 공용 함수 `inquiryResponseLate` 한 곳에서(오늘 업무 · 주간 브리핑 · KPI 가 같은 함수를 본다). band 3, status '이관 기록 확인', '지금 바로'에서 제외, 필터 '첫 연락 늦음' 건수에서 빠지고 '전체'에는 남는다. `lag` 경과 표시 안 함.
5. **영업사원 관리 (`exec-wording.js firstBefore` → `reps-b.js` · `reps-v2.js` unresponded)**: review 는 `first` 에서 빼고 `counts.fix`(기록 보완)로 센다. 사람별 '첫 연락 전 n' 옆에 '기록 보완 n'. 총량 = first + fix 가 변하지 않는지 검증.
6. **주간 브리핑 (`brief-b.js` `no_response`)**: `nr` 에서 review 제외. 별도 후보 `contact_review` = '이관 기록 확인 n건' / why '메모에 통화 후보가 있으나 실제 연결 기록이 없는 문의' / act '통화 후보 확인 → 실제 연결일 보완 또는 새 연락' / due '금요일'.
7. **KPI (`kpi-v7.js stageGroups` r1 · 2시간 첫 연락률, `kpi-measure.js`)**: review 는 '첫 연락 전 넘김'(r1)에서 빼고 분모(base · asg)에서도 뺀다 = **'측정 불가'**(kpi-measure `NA_TAG` 전례). 묶음 total 은 그대로(ms.length). 검증: total = 확인된 분류 + 검토 대상.

## 해제 조건 (조건 5)

목록 · 집계 분류는 **서버가 확인한 것만** 믿는다.
- `InquiryMemo.contactReview` 가 'supplemented' 로 보는 `review.call` 은 서버 응답(SRV)만. 로컬 낙관 patch(`p.call`)는 상세 날짜 블록 표시에만 쓰고 분류에는 쓰지 않는다. 구현은 `contactReview(q,{serverOnly:true})` 또는 `connection` 내부 분기 중 Codex 선택.
- 새 연결 기록은 InquiryFlow connected 로그(서버 저장 뒤 재조회에 반영된 것).
- 서버 저장 실패 · 거부 시 '기록 보완' 그대로. 성공 뒤에만 후속 · 정상으로 옮긴다.

## 검증 (Codex 가 PR 에 남길 것)

- 신영프로방스: 목록 탭 '기록 보완', 꼬리표 '이관 기록 확인', l2 '… 메모에 1.16 통화 후보', 경과 없음. '첫 연락 전' 탭에 없음. 오늘 업무 '첫 연락 늦음' 아님. KPI 첫 연락 전 넘김에서 빠지고 측정 불가로 셈. 주간 브리핑 '이관 기록 확인' 후보에 포함.
- 전체 = 다섯 칸 합(`tests/inquiry-memo*.test.cjs` · `scripts/verify-inquiry-v4-browser.cjs` 에 검사 추가).
- 연락처 없는 검토 대상 → '연락처 보완' 유지. 미배정 검토 대상 → '배정 필요'.
- [1.16 통화로 실제 연결일 보완] 서버 성공 → 후속 · 정상으로 이동. 실패 → 기록 보완 그대로.
- 날짜 없는 후보 → 남고 ④ 맨 뒤.
- 끄기 `G.inqMemoOff` → 검토 대상 0, 모든 화면이 예전 판정으로 복귀.

## 하지 않는 것

새 탭 · 새 색 · 배치 변경 없음. 메모 후보 자동 확정 없음. SQL · RPC 변경 없음. 운영 원자료 변경 없음.

## Codex 에 붙여 넣을 문장

> docs/CLAUDE_INQUIRY_CONTACT_REVIEW_DECISION_20261009.md 대로 '이관 기록 확인' 분류를 연결해줘. 판정은 InquiryListV3.model 의 review 필드 한 곳, 표시는 목록 v4 다섯째 칸(이름 '기록 보완' · 꼬리표 '이관 기록 확인' · ④ 과거 기록 정리 · 기한 없음), 오늘 업무 · 영업사원 관리 · 주간 브리핑 · KPI 는 문서의 화면별 연결 위치대로. 새 탭 · 색 · 배치는 만들지 말고, 해제는 서버 확인 뒤에만. 전체 = 다섯 칸 합 검사를 테스트에 넣고 끝나면 바뀐 파일을 알려줘.
