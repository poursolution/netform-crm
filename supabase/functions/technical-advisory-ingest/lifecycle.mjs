// Operational stages only. Never generates or changes contract performance events.
const CONTRACT = new Set(['vendor_contract_draft_sent','owner_contract_received','contract_ready','contract_writing','consulting_contract_sent','contract_sent','signing_in_progress','sent_to_modusign','consulting_contract_completed','handover_ready','contract_completed','signed_completed']);
const BLOCKED = new Set(['termination_sent','contract_terminated','archived']);
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0,10) === value ? value : null;
}
export function operationalSnapshot(data = {}) {
  const si = data.siteInfo || {};
  const rate = typeof si.progressRate === 'number' ? si.progressRate :
    typeof si.progressRate === 'string' && /^\d+(\.\d+)?$/.test(si.progressRate) ? Number(si.progressRate) : null;
  return {
    schema_version: 2,
    source_status: typeof data.status === 'string' ? data.status : '',
    completed: si.isCompleted === true,
    progress_rate: rate !== null && Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : null,
    start_date: date(si.startDate),
    completion_date: date(si.completionDate)
  };
}
export function lifecycleDecision(snapshot, today) {
  if (!date(today)) throw new Error('VALID_KOREA_TODAY_REQUIRED');
  if (BLOCKED.has(snapshot.source_status)) return {stage: null, reason: 'SOURCE_REVIEW_REQUIRED'};
  if (snapshot.completed === true) {
    if (snapshot.schema_version !== 2 || !date(snapshot.completion_date) || snapshot.completion_date > today) return {stage:null,reason:'COMPLETION_FACTS_REQUIRED'};
    return {stage:'won',reason:'COMPLETION_CONFIRMED'};
  }
  if (snapshot.progress_rate === 100) return {stage:null,reason:'COMPLETION_FACTS_REQUIRED'};
  if (snapshot.progress_rate > 0) return {stage:'construction',reason:'WORK_PROGRESS_RECORDED'};
  if (CONTRACT.has(snapshot.source_status)) return {stage:'contract',reason:'CONTRACT_IN_PROGRESS'};
  return {stage:null,reason:'INSUFFICIENT_EVIDENCE'};
}

// Identity comes only from an explicit reviewed source-project/Deal link.
// Do not infer it from apartment name, current owner, or the first Deal on a Site.
export function transitionPlan({snapshot,today,dealId,currentStage,lastSyncedStage,revision,appliedRevision}) {
  if (!/^[1-9]\d{0,24}$/.test(String(revision))) throw new Error('INVALID_REVISION');
  const decision = lifecycleDecision(snapshot,today);
  if (!dealId) return {...decision,apply:false,reason:'EXACT_DEAL_LINK_REQUIRED'};
  if (appliedRevision != null && BigInt(revision) < BigInt(appliedRevision)) return {...decision,apply:false,reason:'STALE_REVISION'};
  if (['lost','badfit','nocontact'].includes(currentStage)) return {...decision,apply:false,reason:'CLOSED_DEAL_REVIEW'};
  if (!decision.stage) return {...decision,apply:false};
  if (lastSyncedStage && currentStage !== lastSyncedStage && currentStage !== decision.stage) return {...decision,apply:false,reason:'MANUAL_STAGE_CHANGE_REVIEW'};
  const rank = {contract:1,construction:2,completion:3,won:4};
  if (rank[currentStage] > rank[decision.stage]) return {...decision,apply:false,reason:'REGRESSION_REVIEW_REQUIRED'};
  return {...decision,apply:currentStage !== decision.stage,reason:currentStage === decision.stage ? 'ALREADY_CURRENT' : decision.reason};
}
