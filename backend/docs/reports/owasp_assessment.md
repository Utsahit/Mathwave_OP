# OWASP Top 10 (2021) Security Assessment

## Assessment Date
June 2026

## Methodology
Manual code review and automated testing against the OWASP Top 10 2021 categories.

---

## A01: Broken Access Control

### Status: ✅ Mitigated

### Controls in Place:
- **Database-driven RBAC**: `requirePermission()` middleware queries live role-permission mappings via `RolePermission` join table
- **Role-based gate**: `requireRole()` middleware for simple role checks
- **Branch isolation**: `branchContext` middleware ensures multi-tenant data isolation
- **Session validation**: Every protected endpoint validates JWT + active session (JTI in DB)
- **87 granular permissions** across 14 categories — no wildcard "admin" access
- **Minimal CUSTOMER surface**: Only `order:create` permission

### Test Verification:
- `tests/security-rbac.test.ts`: 25+ test cases verifying role isolation
- `tests/branch-isolation.test.ts`: 4 cross-branch access tests
- `tests/auth.test.ts`: Session replay detection, token lifecycle

### Residual Risk:
- Permission lookup is per-request (no caching) — potential DoS on permission table
- No rate limiting on permission enumeration attempts

---

## A02: Cryptographic Failures

### Status: ✅ Mitigated

### Controls in Place:
- **bcrypt** (12 rounds) for password hashing
- **SHA-256** for refresh token hashing at rest
- **HMAC-SHA256** for Razorpay signature verification
- **HMAC-SHA256** for Razorpay webhook verification
- **JWT** signed with HS256
- **TLS/HTTPS** assumed at infrastructure level (Nginx/Load Balancer)
- Pino logger redacts passwords, tokens, cookies

### Test Verification:
- `tests/payment.test.ts`: Signature verification, webhook validation
- `tests/auth.test.ts`: Token format validation

### Residual Risk:
- No encryption at rest for database (relies on PostgreSQL TDE or filesystem encryption)
- JWT secret strength depends on environment configuration

---

## A03: Injection

### Status: ✅ Mitigated

### Controls in Place:
- **Prisma ORM**: All database queries use parameterized queries via Prisma ORM
- **Zod validation**: All user input validated against strict schemas before processing
- **Fixed SQL injection vector**: Replaced `$executeRawUnsafe` in `payment.service.ts` with parameterized Prisma update
- **Content moderation**: Profanity filtering in contact/review submissions (additional sanitization layer)

### Test Verification:
- `tests/security-sqli.test.ts`: 15 SQL injection payloads tested against search, filter, login, register, reservation, contact, review, and analytics endpoints

### Residual Risk:
- Raw SQL in database migrations (one-time, not user-facing)
- Prisma `$queryRaw` usage in any future code must be reviewed

---

## A04: Insecure Design

### Status: ✅ Mitigated

### Controls in Place:
- **Rate limiting**: Global (100/15min) + per-endpoint (login 5/min, register 5/hr, etc.)
- **Account lockout**: 5 failed attempts = 15-min lockout
- **Token rotation**: Refresh tokens rotated on every use
- **Replay detection**: Used tokens tracked in Redis, triggers full session revocation
- **Idempotency**: Payment webhooks tracked in `WebhookEvent` table
- **Double-payment prevention**: `isOrderAlreadyPaid()` check before creating Razorpay order
- **Soft delete**: Data preserved for audit, never truly destroyed

### Test Verification:
- `tests/rate-limit.test.ts`: Rate limiter configuration validation
- `tests/payment.test.ts`: Double-payment prevention, idempotency

### Residual Risk:
- Rate limiter falls back to memory store if Redis unavailable (bypassable)
- No CAPTCHA on registration/login forms

---

## A05: Security Misconfiguration

### Status: ✅ Partially Mitigated

### Controls in Place:
- **Helmet**: Standard HTTP security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
- **CORS**: Restricted in production to configured origins
- **Body parser limits**: 10MB global limit
- **File upload limits**: 5MB, image-only (JPG, JPEG, PNG, WEBP)
- **Error handling**: Stack traces hidden in production
- **Docker**: Non-root user (`appuser`)
- **Trust proxy**: Configured for reverse proxy

### Issues Found:
| Issue | Severity | Status |
|-------|----------|--------|
| CSP disabled for SPA | Low | Accepted — SPA requires inline styles |
| Debug endpoints in production | None | No debug endpoints found |
| Default credentials seeded | Low | Test accounts with known passwords — production must change |
| CORS `*` in dev with credentials | Low | Browsers block this, but config should be tightened |

### Test Verification:
- `src/middleware/security.ts`: Header configuration review
- `docs/reports/security_headers.md`: Detailed header audit

---

## A06: Vulnerable & Outdated Components

### Status: ⚠️ Needs Attention

### Audit Results (npm audit):
| Severity | Count | Packages |
|----------|-------|----------|
| Critical | 0 | — |
| High | 3 | nodemailer (8 advisories), tar (7 advisories) |
| Moderate | 22 | js-yaml, uuid (via autocannon) |

### Actions Taken:
- `payment.service.ts`: Fixed raw SQL injection vector
- nodemailer (high): Acceptable risk — SMTP credentials are environment-restricted
- tar (high): Dev dependency only (`@mapbox/node-pre-gyp`) — no user input processed
- `docs/reports/dependency_audit.md`: Full dependency audit report

### Recommendation:
- Upgrade nodemailer to v9.0.1 when compatible with existing mail service
- Consider `npm audit fix` for moderate-severity js-yaml and uuid issues

---

## A07: Identification & Authentication Failures

### Status: ✅ Mitigated

### Controls in Place:
- **JWT dual-token**: 15-min access tokens limit exposure window
- **Session tracking**: Every token tied to `UserSession` row; session deletion revokes immediately
- **Refresh token rotation**: Prevents long-lived token theft
- **Replay detection**: Automatic full session revocation on token replay
- **Password complexity**: Min 8 chars, mixed case, digits, special chars
- **Account lockout**: 5 failed attempts = 15-min lockout
- **Rate limiting**: Login endpoint limited to 5 req/min
- **Security logging**: All auth events logged to `security.log`

### Test Verification:
- `tests/auth.test.ts`: Full auth lifecycle (305 lines)
- `tests/security-rbac.test.ts`: Token tampering, role bypass tests

### Residual Risk:
- Access tokens valid for 15 min even after logout (design trade-off — stateless JWT)
- No MFA/2FA support (out of scope for this phase)

---

## A08: Software & Data Integrity Failures

### Status: ✅ Mitigated

### Controls in Place:
- **Razorpay webhook signature verification**: HMAC-SHA256 with `RAZORPAY_WEBHOOK_SECRET`
- **Idempotency**: `WebhookEvent` table prevents duplicate webhook processing
- **No CI/CD pipeline issues**: No unsigned dependencies or build artifacts
- **Dependency lock**: `package-lock.json` ensures reproducible installs

### Test Verification:
- `tests/payment.test.ts`: Webhook signature validation, idempotency guard

---

## A09: Security Logging & Monitoring Failures

### Status: ✅ Mitigated

### Controls in Place:
- **Dedicated security log**: `security.log` with separate pino logger instance
- **Redacted sensitive data**: Passwords, tokens, cookies redacted in all logs
- **Request logging**: Every HTTP request logged with method, URL, status, duration, IP
- **Audit trail**: `AuditLog` table tracks all CRUD operations on critical entities
- **Error logging**: Prisma errors, AppErrors, unhandled errors logged with context
- **Rate limit tracking**: Rate limit hits logged (when triggered)

### Test Verification:
- `docs/reports/logging_audit.md`: Full logging audit

### Residual Risk:
- No centralized SIEM integration
- No automated alerting on security events (e.g., replay attacks, account lockouts)

---

## A10: Server-Side Request Forgery (SSRF)

### Status: ✅ Mitigated

### Controls in Place:
- **No user-controlled URLs** are fetched server-side
- **Razorpay SDK**: Uses well-known API endpoints (not user-configurable)
- **Nodemailer**: SMTP host is configured via environment, not user input
- **Image uploads**: File type validation prevents URL-based uploads
- **No proxy functionality**: Application does not forward user requests to third parties

### Test Verification:
- Code review of all service files — no `http.get`, `axios`, or `fetch` with user-provided URLs

### Residual Risk:
- Razorpay webhook URL is from header — but signature verification prevents spoofing

---

## Overall Assessment Summary

| Category | Status | Risk Level |
|----------|--------|------------|
| A01: Broken Access Control | ✅ Mitigated | Low |
| A02: Cryptographic Failures | ✅ Mitigated | Low |
| A03: Injection | ✅ Mitigated | Low |
| A04: Insecure Design | ✅ Mitigated | Low |
| A05: Security Misconfiguration | ⚠️ Partially | Low |
| A06: Vulnerable Components | ⚠️ Needs Attention | Medium |
| A07: Authentication Failures | ✅ Mitigated | Low |
| A08: Integrity Failures | ✅ Mitigated | Low |
| A09: Logging & Monitoring | ✅ Mitigated | Low |
| A10: SSRF | ✅ Mitigated | Low |

## Key Recommendations
1. Upgrade nodemailer to v9.0.1
2. Add CSP with nonce-based allowlisting
3. Implement permission caching
4. Consider adding CAPTCHA on registration
5. Add automated alerting for security events (replay attacks, account lockouts)
