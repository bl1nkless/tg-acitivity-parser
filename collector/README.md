## Collector Service

Telethon-based worker that listens for `UpdateUserStatus` MTProto updates, persists online/offline events, and reconciles dangling sessions.

### Capabilities

- Push-driven presence updates with adaptive TTL grace period.
- Auto-closes stale sessions when MTProto updates are missed.
- Records `StatusEvent` rows for every change (exact/approx).
- Rolls session durations into hourly aggregates as sessions close.

### Environment Variables

| Variable | Description |
| --- | --- |
| `TG_API_ID` / `TG_API_HASH` | Telegram API credentials (https://my.telegram.org/apps). |
| `SESSION_PATH` | File path for the Telethon session (*.session). Defaults to `session_store/collector.session`. |
| `DATABASE_URL` | Async SQLAlchemy URL, e.g. `postgresql+asyncpg://postgres:pass@postgres:5432/postgres`. |
| `REDIS_URL` | Redis connection string for presence TTL tracking. |
| `TTL_GRACE_SECONDS` | Extra seconds added to Telethon `expires` before auto-closing sessions. |

### Run Locally

```bash
python -m collector.login          # interactive login once
python -m collector.app            # start event loop
```

Ensure the database migrations are applied before running the collector.
