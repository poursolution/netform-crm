# Attachment compatibility — T01/T02 local candidate

Status: `DERIVED_SAFE_LOCAL_CANDIDATE_NOT_APPLIED`

This package connects the reachable PC/mobile `attachment_prepare → signed upload → attachment_complete` workflow without n8n. It does not change the existing buttons, categories, 10-file batch, 20 MiB limit, batch activity, or ACK correlation.

The database creates private pending metadata and a server-generated object path. The browser then asks Supabase Storage for a signed upload token using its current JWT and uploads through `uploadToSignedUrl`; no service-role secret or permanent URL reaches the browser. `attachment_complete` locks the metadata row and verifies the real `storage.objects` bucket, path, owner, size, and MIME before making it visible as `ready`.

Deal reads expose only ready display metadata: `id,file_name,mime_type,size_bytes,category,tags,memo,uploaded_by,status,created_at`. Object paths and signed/download URLs are not projected.

Completed files in a partially failed multi-file batch remain canonical and reappear after refresh. The existing single batch activity is still emitted only when all selected files finish; this candidate does not create duplicate per-file activities. Every prepare/complete has its own private audit and idempotent receipt.

Pending rows expire after 24 hours and never appear in UI reads. SQL rollback removes the upload policy and public command/read layers but deliberately does not delete Storage bytes or the bucket. Before cutover, an authenticated Storage-API cleanup operator and a Staging JWT test for expired pending/orphan objects are still required. For that reason this is a local candidate, not `STAGING_COMPAT_PASS`.

No Staging DDL/DML, Production access, n8n access, or operating Pages access was performed.
