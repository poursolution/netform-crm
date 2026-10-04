// Review-only import boundary. Never writes Deal or contract-performance data.
const text = value => typeof value === 'string' ? value.trim() : '';
function money(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (typeof value !== 'string' || !/^\d+(?:,\d{3})*$/.test(value.trim())) return null;
  const n = Number(value.replaceAll(',', ''));
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}
function timestamp(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))) return value;
  const seconds = value?.seconds ?? value?._seconds;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;
  const d = new Date(seconds * 1000);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
function safeUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; }
  catch { return null; }
}
function requireId(value, label) {
  const id = text(value);
  if (!id || id.length > 256 || /[\x00-\x1f]/.test(id)) throw new Error(`INVALID_${label}`);
  return id;
}

/** Input: explicit Firestore document ID and its exported document data.
 * Names are display-only: matching a CRM Deal requires a separate reviewed link.
 */
export function normalizeProject({ projectId, data }) {
  projectId = requireId(projectId, 'PROJECT_ID');
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('INVALID_PROJECT');
  const records = data.contractRecords;
  if (records != null && !Array.isArray(records)) throw new Error('INVALID_CONTRACT_RECORDS');
  const byDocument = new Map();
  for (const record of records || []) {
    if (!record || typeof record !== 'object') throw new Error('INVALID_CONTRACT_RECORD');
    const documentId = requireId(record.documentId, 'DOCUMENT_ID');
    const review = ['CRM_LINK_REQUIRED', 'SIGNED_DATE_EVIDENCE_REQUIRED', 'SALES_OWNER_EVIDENCE_REQUIRED'];
    const amount = money(record.contractAmount);
    if (amount === null) review.push('DOCUMENT_AMOUNT_REQUIRED');
    const completedAt = timestamp(record.completedAt);
    const sourceStatus = text(record.status);
    if (sourceStatus !== 'completed') review.push('SIGNING_NOT_COMPLETED');
    if (sourceStatus === 'completed' && !completedAt) review.push('COMPLETION_EVIDENCE_REQUIRED');
    if (data.modusign?.mock === true || record.mock === true) review.push('MOCK_PROJECT');
    const kind = text(record.type);
    if (!['initial_contract', 'change_contract', 'post_settlement_recontract'].includes(kind)) review.push('CONTRACT_KIND_REQUIRED');
    if (kind !== 'initial_contract') review.push('CONTRACT_CHAIN_REVIEW_REQUIRED');
    const currentAmount = money(data.consultingContractAmount);
    // Only compare the current document against current project values.
    if (data.modusign?.documentId === documentId && currentAmount !== null && amount !== null && amount !== currentAmount) {
      review.push('CURRENT_DOCUMENT_AMOUNT_CONFLICT');
    }
    const row = {
      source: 'fee-crosscheck', source_project_id: projectId,
      source_document_id: documentId,
      import_key: JSON.stringify(['fee-crosscheck', projectId, documentId]),
      site_name: text(data.aptName), work_name: text(data.constructionName),
      company_name: text(data.companyName), company_manager: text(data.companyManager),
      current_source_manager: text(data.managerName),
      source_project_status: text(data.status),
      source_contract_document_type: text(data.contractDocumentType),
      contract_kind: kind, source_status: sourceStatus,
      document_amount: amount,
      source_printed_contract_date: text(data.contractDate) || null,
      sent_at: timestamp(record.sentAt), completion_observed_at: completedAt,
      document_url: safeUrl(record.documentUrl),
      previous_document_id: text(record.previousDocumentId) || null,
      root_document_id: text(record.rootDocumentId) || null,
      // Current payment conditions cannot be attributed to older contracts.
      current_project_payment_conditions: (Array.isArray(data.paymentStages) ? data.paymentStages : []).map(s => ({
        name: text(s?.name), condition: text(s?.condition),
        percent: typeof s?.pct === 'number' && s.pct >= 0 && s.pct <= 100 ? s.pct : null
      })),
      source_document_events: (Array.isArray(data.contractHistoryEvents) ? data.contractHistoryEvents : [])
        .filter(event => event?.documentId === documentId)
        .map(event => ({ event: text(event.event), completed_at: timestamp(event.completedAt) })),
      crm_deal_id: null, sales_owner: null, recognized_contract_date: null,
      performance_eligible: false, review_reasons: review
    };
    const previous = byDocument.get(documentId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) throw new Error('CONFLICTING_DOCUMENT_DUPLICATE');
    byDocument.set(documentId, row);
  }
  // Legacy documents have no document-scoped amount or reliable contract kind.
  // Keep the observation without manufacturing an initial signing event.
  if (text(data.modusign?.documentId) && !byDocument.has(text(data.modusign.documentId))) {
    const documentId = requireId(data.modusign.documentId, 'DOCUMENT_ID');
    const review = ['LEGACY_DOCUMENT_REVIEW_REQUIRED', 'DOCUMENT_AMOUNT_REQUIRED',
      'CONTRACT_KIND_REQUIRED', 'CRM_LINK_REQUIRED', 'SIGNED_DATE_EVIDENCE_REQUIRED', 'SALES_OWNER_EVIDENCE_REQUIRED'];
    if (data.modusign.mock === true) review.push('MOCK_PROJECT');
    if (data.modusign.status !== 'document_all_signed') review.push('SIGNING_NOT_COMPLETED');
    const completedAt = timestamp(data.modusign.completedAt);
    if (!completedAt) review.push('COMPLETION_EVIDENCE_REQUIRED');
    byDocument.set(documentId, {
      source: 'fee-crosscheck', source_project_id: projectId, source_document_id: documentId,
      import_key: JSON.stringify(['fee-crosscheck', projectId, documentId]),
      source_structure: 'legacy_modusign', site_name: text(data.aptName),
      work_name: text(data.constructionName), company_name: text(data.companyName),
      current_source_manager: text(data.managerName), source_status: text(data.modusign.status),
      completion_observed_at: completedAt, source_printed_contract_date: text(data.contractDate) || null,
      document_amount: null, contract_kind: null, crm_deal_id: null, sales_owner: null,
      recognized_contract_date: null, performance_eligible: false, review_reasons: review
    });
  }
  return {
    source_project_id: projectId,
    review_reasons: records?.length ? [] : ['DOCUMENT_HISTORY_REQUIRED'],
    contracts: [...byDocument.values()]
  };
}

export function prepareImport(projects) {
  if (!Array.isArray(projects)) throw new Error('PROJECT_ARRAY_REQUIRED');
  const seen = new Set();
  return projects.map(project => {
    const result = normalizeProject(project);
    if (seen.has(result.source_project_id)) throw new Error('DUPLICATE_PROJECT');
    seen.add(result.source_project_id);
    return result;
  });
}
