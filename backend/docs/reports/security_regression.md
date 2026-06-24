# Security Regression Report

## Status: BLOCKED — Infrastructure Required

Security regression tests require running PostgreSQL and Redis.

---

## Phase 18 Security Test Summary

| Test File | Tests | Status | Notes |
|-----------|-------|--------|-------|
| `tests/security-rbac.test.ts` | 30 | ❌ BLOCKED | Requires PostgreSQL + Redis |
| `tests/security-sqli.test.ts` | 15 SQLi payloads x endpoints | ❌ BLOCKED | Requires PostgreSQL |
| `tests/security-xss.test.ts` | 16 XSS payloads x endpoints | ❌ BLOCKED | Requires PostgreSQL |
| `tests/security-websocket.test.ts` | 9 | ❌ BLOCKED | Requires running app |
| `tests/rate-limit.test.ts` | 9 | ❌ BLOCKED | Requires running app |

## Code-Level Security Review (Static)

| Category | Coverage | Verified |
|----------|----------|----------|
| RBAC middleware (`requirePermission`) | All admin/manager routes | ✅ |
| Input validation (`zod` schemas) | All mutation endpoints | ✅ |
| Rate limiting (memory fallback) | Auth, contact, review, newsletter, reservation, payment | ✅ |
| Parameterized queries (Prisma) | All database access | ✅ |
| JWT dual-token auth | Access + Refresh with rotation and replay detection | ✅ |
| HSTS configuration | `maxAge: 31536000`, `includeSubDomains`, `preload` | ✅ |
| Helmet security headers | X-Frame-Options, X-Content-Type-Options, Referrer-Policy | ✅ |
| CSP intentionally disabled | Required for SPA compatibility | ✅ |
| Pino log redaction | Passwords, tokens, cookies filtered | ✅ |

## Phase 18 Fixed Vulnerabilities

| ID | Finding | Fix | File |
|----|---------|-----|------|
| SQL-001 | Raw SQL in payment update | Replaced with Prisma parameterized query | `src/services/payment.service.ts` |
| SEC-001 | HSTS not explicitly configured | Added `maxAge`, `includeSubDomains`, `preload` | `src/middleware/security.ts` |

## Verification Commands (when infrastructure is available)

```bash
npx jest tests/security-rbac.test.ts --runInBand
npx jest tests/security-sqli.test.ts --runInBand
npx jest tests/security-xss.test.ts --runInBand
npx jest tests/security-websocket.test.ts --runInBand
npx jest tests/rate-limit.test.ts --runInBand
```

Expected: 0 regressions from Phase 18.

---

*Generated: Phase 19 — Security Regression*
