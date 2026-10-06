import { operationalSnapshot } from './lifecycle.mjs';

const text = value => typeof value === 'string' ? value.trim() : '';
function money(value) {
  if (typeof value === 'string' && /^\d+(?:,\d{3})*$/.test(value.trim())) value = Number(value.replaceAll(',', ''));
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

// Source observations only: independent of document history and CRM Deal links.
// Do not treat the advisory contract amount/date or current manager as sales evidence.
export function projectSnapshot({ projectId, data }) {
  if (typeof projectId !== 'string' || !projectId.trim() || projectId.length > 256 || /[\x00-\x1f]/.test(projectId) ||
      !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('INVALID_PROJECT');
  const result = {
    schema_version: 1,
    source_project_id: projectId.trim(),
    operations: operationalSnapshot(data)
  };
  for (const [source, target] of [
    ['aptName', 'site_name'], ['constructionName', 'work_name'], ['companyName', 'company_name'],
    ['managerName', 'current_source_manager'], ['status', 'source_project_status'],
    ['contractDocumentType', 'source_contract_document_type']
  ]) if (Object.hasOwn(data, source)) result[target] = text(data[source]);
  // An omitted source field is not evidence that an existing value was cleared.
  if (Object.hasOwn(data, 'contractDate')) result.source_printed_contract_date = text(data.contractDate) || null;
  if (Object.hasOwn(data, 'consultingContractAmount')) result.source_consulting_contract_amount = money(data.consultingContractAmount);
  return result;
}
