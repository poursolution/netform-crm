# Aligo server runner

Node.js 24 server-only modules for netform-crm. Keep credentials and SQLite state outside the repository and frontend release.

Run `npm run test:aligo` for provider, restart/idempotency and Postgres queue tests.

See [deployment and verification](../../docs/aligo-integration-20260919.md) before enabling the worker. Production queue migration is applied; unattended sending remains disabled pending server credentials.
