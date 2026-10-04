import { handler } from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
Deno.serve(handler({
  secret:Deno.env.get('CRM_CONTRACT_SYNC_SECRET'),
  async store(projectId:string,revision:string,snapshot:unknown,operations:unknown){
    const response=await fetch(url+'/rest/v1/rpc/crm_advisory_ingest_v2',{
      method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'content-type':'application/json'},
      body:JSON.stringify({p_project_id:projectId,p_revision:revision,p_snapshot:snapshot,p_operations:operations})
    });
    if(!response.ok)throw new Error('PERSIST_FAILED');
    return await response.json();
  }
}));
