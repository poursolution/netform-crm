# M02 `message_log` local compatibility candidate

Status: `DERIVED_SAFE_LOCAL_CANDIDATE_NOT_APPLIED`.

The reachable PC and mobile confirmation handlers have one stable meaning: the user opened an external SMS/Kakao app and then explicitly attested `sent`, `failed`, or `cancelled`. A `sent` record is therefore `user_attested`; it is not provider delivery evidence.

The compatibility overlay absorbs the existing `message_log` + `activity` + optional `next_action` writes emitted by those named handlers and sends one versioned `message_log` command. The server resolves the current Deal contact, phone, actor, and time, validates any quote/ready attachment reference, and commits all applicable rows, audit, Deal version, and receipt in one transaction. `failed` and `cancelled` never create Activity or Next Action.

This package does not send a message, does not connect n8n, and has not been applied to Staging. Separate approval and JWT integration tests are required.
