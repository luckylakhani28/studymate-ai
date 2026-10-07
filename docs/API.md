# API

Base path `/api/v1`. JSON envelope: `{ success: true, data, meta? }` or `{ success: false, error: { code, message, details? }, requestId }`. All inputs are validated with zod; another user's resources always return 404.

| Method | Route                         | Auth   | Purpose                                                                             |
| ------ | ----------------------------- | ------ | ----------------------------------------------------------------------------------- |
| GET    | `/api/health`                 | —      | Liveness + DB status                                                                |
| POST   | `/auth/register`              | —      | Create account → user, access token, refresh cookie                                 |
| POST   | `/auth/login`                 | —      | Log in (failed attempts rate-limited)                                               |
| POST   | `/auth/refresh`               | cookie | Rotate refresh token → new access token + user                                      |
| POST   | `/auth/logout`                | cookie | Revoke this session                                                                 |
| POST   | `/auth/logout-all`            | ✓      | Revoke every session                                                                |
| GET    | `/auth/me`                    | ✓      | Current user                                                                        |
| POST   | `/documents`                  | ✓      | Upload PDF (multipart `file`) → 202 queued                                          |
| GET    | `/documents`                  | ✓      | List: `page, limit, status, q`                                                      |
| GET    | `/documents/:id`              | ✓      | Document with extraction stats and outline                                          |
| GET    | `/documents/:id/status`       | ✓      | Lightweight status for polling                                                      |
| GET    | `/documents/:id/file`         | ✓      | Stream the original PDF (sandboxed)                                                 |
| GET    | `/documents/:id/chunks`       | ✓      | Processed passages (active generation)                                              |
| PATCH  | `/documents/:id`              | ✓      | Rename / tag                                                                        |
| POST   | `/documents/:id/reprocess`    | ✓      | Requeue a ready or failed document                                                  |
| DELETE | `/documents/:id`              | ✓      | Delete with chunks, artifacts, and file                                             |
| POST   | `/documents/:id/artifacts`    | ✓      | Request summary / notes / key_concepts / quiz / flashcards (200 cached, 202 queued) |
| GET    | `/documents/:id/artifacts`    | ✓      | List study items: `type, limit`                                                     |
| GET    | `/artifacts/:id`              | ✓      | One study item                                                                      |
| DELETE | `/artifacts/:id`              | ✓      | Delete a study item                                                                 |
| POST   | `/search`                     | ✓      | Hybrid search across your documents                                                 |
| POST   | `/conversations`              | ✓      | Start a conversation over 1–10 ready documents                                      |
| GET    | `/conversations`              | ✓      | List conversations                                                                  |
| GET    | `/conversations/:id`          | ✓      | Conversation + messages (`before` cursor, `limit`)                                  |
| PATCH  | `/conversations/:id`          | ✓      | Rename                                                                              |
| DELETE | `/conversations/:id`          | ✓      | Delete with messages                                                                |
| POST   | `/conversations/:id/messages` | ✓      | Ask a question → Server-Sent Events: `start`, `token`*, `done` or `error`           |
| GET    | `/usage/me`                   | ✓      | Rolling 24h AI usage vs. limit, by feature and day                                  |

## Notable error codes

`VALIDATION_ERROR` 400 · `UNAUTHORIZED` / `TOKEN_EXPIRED` / `INVALID_TOKEN` 401 · `NOT_FOUND` 404 · `DUPLICATE_DOCUMENT`, `ALREADY_PROCESSING`, `DOCUMENT_NOT_READY`, `REFRESH_RACE` 409 · `FILE_TOO_LARGE` 413 · `UNSUPPORTED_FILE` 415 · `RATE_LIMITED`, `QUOTA_EXCEEDED` 429 · `AI_OUTPUT_INVALID` 502 · `LLM_UNAVAILABLE` 503
