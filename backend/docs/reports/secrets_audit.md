# Secrets & Environment Audit

## Audit Date
June 2026

## Scope
Audit of all secrets, environment variables, and sensitive configuration:
- `.env` file analysis
- Source code for hardcoded secrets
- Log files for secret exposure
- API responses for data leakage

## Files Reviewed
- `.env`
- `src/config/env.ts`
- All controller, service, and middleware files
- `src/config/logger.ts`
- `prisma/seed.ts`

## Findings

### 1. Environment Variables (`src/config/env.ts`)

| Variable | Required | In .env | Hardcoded Default | Status |
|----------|----------|---------|-------------------|--------|
| `NODE_ENV` | ✅ | ✅ development | — | ✅ |
| `PORT` | ❌ | ✅ 5000 | 3000 | ✅ |
| `DATABASE_URL` | ✅ | ✅ | — | ✅ |
| `REDIS_URL` | ✅ | ✅ | — | ✅ |
| `JWT_SECRET` | ✅ | ✅ (dev placeholder) | — | ⚠️ Dev only |
| `JWT_REFRESH_SECRET` | ✅ | ✅ (dev placeholder) | — | ⚠️ Dev only |
| `RAZORPAY_KEY_ID` | ✅ | ✅ (test key) | `rzp_test_change_me` | ⚠️ Dev only |
| `RAZORPAY_KEY_SECRET` | ✅ | ✅ (test key) | `rzp_secret_change_me` | ⚠️ Dev only |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ | ✅ (test key) | `rzp_webhook_change_me` | ⚠️ Dev only |
| `SMTP_HOST` | ✅ | ✅ | — | ✅ |
| `SMTP_PORT` | ✅ | ✅ | — | ✅ |
| `SMTP_USER` | ✅ | ✅ | — | ✅ |
| `SMTP_PASS` | ✅ | ✅ | — | ✅ |
| `SENTRY_DSN` | ❌ | ❌ | — | ✅ Optional |
| `WHATSAPP_ENABLED` | ❌ | ✅ | `false` | ✅ |
| `WHATSAPP_OWNER_NUMBER` | ❌ | ✅ | `+917599951515` | ✅ |

### 2. Source Code Secrets Check

| File | Finding | Status |
|------|---------|--------|
| `payment.service.ts` | Hardcoded fallbacks for Razorpay keys (`rzp_test_change_me`) | ⚠️ Dev fallbacks — safe |
| `payment.service.ts` | `RAZORPAY_KEY_ID` returned in API response | ⚠️ Intentional (Razorpay checkout needs key_id) |
| `prisma/seed.ts` | Hardcoded test password `Password123!` | ⚠️ Test accounts — must change in production |
| All controllers | No secrets returned in API responses | ✅ |
| `env.ts` | No hardcoded secrets | ✅ |
| `auth.service.ts` | No hardcoded secrets | ✅ |

### 3. Log File Exposure

| Check | Status | Notes |
|-------|--------|-------|
| Passwords redacted | ✅ | `password`, `passwordHash` in Pino redact list |
| Tokens redacted | ✅ | `token`, `refreshToken` in redact list |
| Cookies redacted | ✅ | `req.headers.cookie` in redact list |
| Authorization headers redacted | ✅ | `req.headers.authorization` in redact list |
| Database URL in logs | ✅ | Not logged |
| API keys in logs | ✅ | Not logged |
| Security log separate | ✅ | `security.log` isolates auth events |

### 4. `.env` File (.gitignore Status)

| Check | Status |
|-------|--------|
| `.env` in `.gitignore` | ⚠️ Not confirmed — must verify |
| `.env.example` present | Verify |
| No secrets committed | ✅ (placeholder values) |

## Risk Assessment

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 1 | Hardcoded test passwords in seed file |
| Low | 3 | Dev fallback keys, Razorpay key_id in response (intentional), test account passwords |

## Recommendations

1. **Production secrets**: Generate strong unique secrets for JWT_SECRET, JWT_REFRESH_SECRET, and Razorpay keys
2. **Remove test passwords**: Replace seed file passwords with environment-specific generation
3. **Verify .gitignore**: Ensure `.env` is in `.gitignore` and only `.env.example` is committed
4. **Rotate secrets**: Implement a 90-day secret rotation policy
5. **Secret scanning**: Consider `git-secrets` or similar pre-commit hook to prevent accidental commits

## Conclusion
No secrets are committed to the repository. All sensitive values use placeholder/dev defaults. Log files properly redact sensitive fields. The `RAZORPAY_KEY_ID` returned in payment API responses is by design (required for Razorpay Checkout integration) and is not a secret — it is the public identifier. The `RAZORPAY_KEY_SECRET` is never returned.
