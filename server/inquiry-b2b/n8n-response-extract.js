const body = $input.first().json.body || {};

const site = decodeURIComponent(body.site || '');
const phone = decodeURIComponent(body.phone || '');
const brand = decodeURIComponent(body.brand || '');
const assignee = decodeURIComponent(body.assignee || '');
const status = body.status || '';
const responseContent = body.responseContent || '';

// === 추적 시스템: 신규 필드 파싱 ===
const nextActionDate = body.nextActionDate || '';
const dealAmount = body.dealAmount || '';
const lostReason = body.lostReason || '';
const lostReasonEtc = body.lostReasonEtc || '';
const badfitReason = body.badfitReason || '';
const badfitReasonEtc = body.badfitReasonEtc || '';
const attemptCount = body.attemptCount || '';
const retryDate = body.retryDate || '';

const PROGRESS = ['전화응대 완료','현장방문예정','견적서 발송예정','보류'];
const CLOSED = ['수주','실주','배드핏','연락두절','협약완료','해결완료','종결'];
const b2bResult = ['협약완료','해결완료','종결'].includes(status);
if (![...PROGRESS,...CLOSED].includes(status) || (!b2bResult && !String(responseContent).trim())) throw new Error('INVALID_RESPONSE');
if (status === '종결' && !String(responseContent).trim()) throw new Error('B2B_CLOSE_REASON_REQUIRED');
const isClosed = CLOSED.includes(status);

let closeReason = '';
if (['협약완료','해결완료','종결'].includes(status)) closeReason = status + (responseContent.trim() ? ' · ' + responseContent.trim() : '');
if (status === '수주') closeReason = dealAmount ? ('수주 · ' + dealAmount) : '수주';
else if (status === '실주') closeReason = '실주 · ' + (lostReason === '기타' ? ('기타: ' + lostReasonEtc) : lostReason);
else if (status === '배드핏') closeReason = '배드핏 · ' + (badfitReason === '기타' ? ('기타: ' + badfitReasonEtc) : badfitReason);
else if (status === '연락두절') closeReason = '연락두절' + (attemptCount ? (' · ' + attemptCount + '회 시도') : '');

let nextDate = '';
if (PROGRESS.includes(status)) nextDate = nextActionDate;
else if (status === '연락두절') nextDate = retryDate;

const now = new Date();
const timestamp = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

return [{
  json: {
    site,
    phone,
    brand,
    assignee,
    status,
    responseContent,
    timestamp,
    occurred_at: now.toISOString(),
    crm_event_id: "n8n:" + $execution.id + ":response",
    closeReason,
    nextDate,
    isClosed
  }
}];