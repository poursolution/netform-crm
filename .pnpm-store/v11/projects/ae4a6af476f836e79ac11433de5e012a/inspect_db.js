async function main() {
  const base = 'https://gndktayoicegyqyllybk.supabase.co/rest/v1';
  const key = 'sb_publishable_J61d8JvrlkNVRyjmAhFwjQ_wExNoZbE';
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const get = async path => {
    const response = await fetch(base + path, { headers });
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
    return response.json();
  };
  const [apartments, contracts, sites] = await Promise.all([
    get('/apartments?select=id,name,status,region,contract_amount,supervision_fee,received_amount'),
    get('/contracts?select=id,apartment_id,name,file_url,kind,created_at'),
    get('/control_sites?select=slug,name,data')
  ]);
  const active = apartments.filter(a => a.status !== 'done').map(a => {
    const card = sites.find(s => s.slug === a.name) || sites.find(s => String(s.name || '').replace(/\s/g, '') === String(a.name || '').replace(/\s/g, ''));
    const data = card && card.data || {};
    return {
      id: a.id,
      name: a.name,
      status: a.status,
      region: a.region,
      contractAmount: a.contract_amount,
      supervisionFee: a.supervision_fee,
      receivedAmount: a.received_amount,
      cycle: data.cycle || null,
      contractType: data.contractType || data.sealed && data.sealed.ctype || null,
      sealedFile: data.sealed && data.sealed.file || null,
      contractRows: contracts.filter(c => c.apartment_id === a.id).map(c => ({ id: c.id, name: c.name, file_url: c.file_url, kind: c.kind }))
    };
  });
  process.stdout.write(JSON.stringify({ counts: { apartments: apartments.length, contracts: contracts.length, sites: sites.length }, active }, null, 2));
}
main().catch(error => { console.error(error); process.exit(1); });
