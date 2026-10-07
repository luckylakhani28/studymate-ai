# Security Model

## Threats and defenses

| Threat                                   | Defense                                                                                                                                          | Proven by                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Reading another user's data              | Every query is scoped by `userId` (`findOwned`); foreign ids return 404, never 403                                                               | `authorization.test.js` (every `:id` route)           |
| Cross-user leakage in search             | `userId` is a pre-filter inside the vector index and the prefix of the text index                                                                | `retrieval.test.js`                                   |
| NoSQL operator injection (`{"$gt": ""}`) | Strict zod schemas; controllers can only read `req.validated` (lint rule)                                                                        | `errorHandling.test.js`, ESLint                       |
| Stolen access token                      | 15-minute lifetime; held in memory, never in localStorage                                                                                        | —                                                     |
| Stolen refresh token                     | httpOnly, SameSite=Strict cookie scoped to `/api/v1/auth`; rotation with reuse detection revokes the family                                      | `auth.test.js`                                        |
| Brute-force login                        | Rate limit on failed attempts; constant-time comparison against a dummy hash                                                                     | `auth.test.js`                                        |
| JWT forgery / algorithm confusion        | HS256 pinned; issuer and audience checked; rotation-friendly secrets                                                                             | `auth.test.js`                                        |
| CSRF                                     | API uses Bearer tokens; the only cookie is SameSite=Strict and path-scoped                                                                       | —                                                     |
| XSS from AI output                       | React escaping; Markdown without raw HTML; only citation links are clickable                                                                     | `AnswerMarkdown.test.jsx`                             |
| Prompt injection inside PDFs             | Sources delimited as data; explicit data-not-instructions rule; tag neutralization; schema-validated output; **the model has no tools that act** | `chat.test.js`, `npm run eval:injection` (real model) |
| Malicious or oversized uploads           | Magic-byte check; size and page caps; pdf.js with `isEvalSupported: false`; job timeouts; worker memory cap; attempt limit                       | `documents.test.js`, `documentJobs.test.js`           |
| Scripts inside a served PDF              | `Content-Security-Policy: default-src 'none'; sandbox` on the file endpoint                                                                      | `documents.test.js`                                   |
| Path traversal in storage                | Server-generated keys only; key regex plus resolved-path check                                                                                   | `LocalStorage.js`                                     |
| Cost abuse                               | Per-user rolling quota checked before each call; per-user AI rate limits                                                                         | `llm.test.js`, `chat.test.js`                         |
| Secrets in logs                          | pino redaction of auth headers, cookies, passwords, tokens, API keys                                                                             | —                                                     |
| Vulnerable dependencies                  | `npm audit` in CI; Dependabot weekly                                                                                                             | CI                                                    |

## Operations

- **Rotate the JWT secret** without logging anyone out: move the current value to `JWT_ACCESS_SECRET_PREVIOUS`, set a new `JWT_ACCESS_SECRET`, deploy, and remove `_PREVIOUS` after 15 minutes.
- **Compromised account:** `POST /auth/logout-all` revokes every refresh token.
- **Atlas network access:** hosts like Render use changing IPs, so allowing `0.0.0.0/0` is common; compensate with a long random database password and a least-privilege database user.

## Known limitations (accepted)

- Registration reveals whether an email exists (409). Accepted for UX; login does not leak it.
- Access tokens stay valid up to 15 minutes after "log out everywhere" or account deletion (stateless JWT trade-off).
- Rate limits use in-memory stores: per instance, not global. A Redis store is needed with several API instances.
- Prompt injection can't be prevented absolutely. Impact is contained: no tools, no actions, validated outputs, user-visible citations.
