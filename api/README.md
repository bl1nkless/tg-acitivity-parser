## FastAPI Backend

REST API exposing tracked users, raw sessions, aggregates, and export endpoints. Provides JWT authentication with admin/viewer roles.

### Key Endpoints

- `POST /auth/token` — obtain JWT (password flow).
- `GET /auth/me` — current user profile.
- `GET /tracked` / `POST /tracked` — list and manage tracked accounts.
- `GET /users/{id}/sessions` — paginated online sessions.
- `GET /users/{id}/agg/hourly` — hourly aggregates.
- `GET /users/{id}/agg/heatmap` — heatmap-friendly payload.
- `GET /users/{id}/export/sessions.{csv,json}` — downloadable exports.
- `DELETE /tracked/{id}?purge=true` — GDPR-compliant hard delete.

### Running for Development

```bash
uvicorn api.main:app --reload --port 8000
```

Environment variables follow `common.config.ApiSettings` (see `pyproject.toml`). For initial bootstrap use `ADMIN_EMAIL`/`ADMIN_PASSWORD` to create the first admin account automatically.
