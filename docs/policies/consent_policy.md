# Consent and Acceptable Use Policy

This system collects **presence-only** telemetry about Telegram accounts that explicitly opt in. It never ingests message content, media, or contact lists.

## Scope

- Only two categories of users may be monitored:
  1. The owner of the collector account.
  2. Collaborators who provided written, recorded, or bot-mediated consent.
- Users can revoke consent at any time. The operator must delete their records from the tracker immediately (`DELETE /tracked/{id}`).
- Users with hidden last-seen privacy settings are flagged as `source_precision = approx` to avoid misleading accuracy claims.

## Operator Responsibilities

1. **Document consent**: store the consent basis (`oral`, `written`, `bot`) and optional reference.
2. **Explain purpose**: share why telemetry is collected, how it will be used, and retention window.
3. **Data minimisation**: keep only timestamps for online/offline session boundaries. Keep retention under 180 days unless required longer.
4. **Security**: secure JWT secrets, Telethon session files, database backups, and enforce strong admin credentials.
5. **Revocation**: provide a channel (email/DM) for users to request deletion; execute within a reasonable SLA (<24h recommended).

## Restricted Activities

- Tracking individuals without an explicit opt-in.
- Attempting to circumvent Telegram privacy rules or MTProto rate limits.
- Combining presence data with message contents or third-party identifiers to build covert surveillance profiles.
- Reselling or sharing exported telemetry with unauthorised parties.

## Data Deletion Checklist

1. `DELETE /tracked/{id}` with `purge=true` (optional query) to drop cascaded sessions and events.
2. Verify no entries remain in `tracked_user`, `status_event`, `online_session`, `agg_hourly`.
3. Remove associated exports/backups referencing the subject.

Maintain an audit log entry (`audit_log` table) describing who deleted the data and when.
