# CSRF (Cross-Site Request Forgery) Assessment

## Assessment Date
June 2026

## Methodology
Review of API design, authentication mechanism, cookie usage, and cross-origin protections.

## Architecture Overview
The application uses a **stateless JWT authentication model**:
- Access tokens sent via `Authorization: Bearer <token>` header
- No session cookies used for API authentication
- CORS configured with specific origins in production

## Findings

### 1. JWT Token Usage

| Check | Status | Notes |
|-------|--------|-------|
| Token in header | ✅ Authorization header | Not vulnerable to cookie-based CSRF |
| Token in cookie | ❌ Not used | No session cookies = no CSRF via cookies |
| Auto-attach | ❌ Not applicable | Client must explicitly attach header |
| SameSite cookies | ❌ Not applicable | No cookies used for auth |

### 2. CORS Configuration (`src/middleware/security.ts`)

| Check | Status | Notes |
|-------|--------|-------|
| Specific origins | ✅ In production | Reads `CORS_ORIGIN` from env |
| Wildcard origin | ⚠️ In development only | `*` with credentials (browsers block credentialed `*`) |
| Credentials | ✅ `credentials: true` | Only relevant if cookies are used |
| Allowed methods | ✅ Restricted to GET, POST, PUT, DELETE, OPTIONS, PATCH | Appropriate subset |
| Allowed headers | ✅ Content-Type, Authorization, X-Requested-With | Necessary minimum |

### 3. Cross-Origin Protections

| Protection | Status | Notes |
|-----------|--------|-------|
| Same-origin policy | ✅ Enforced by browser | Standard SOP applies |
| Preflight requests | ✅ CORS preflight for non-simple requests | OPTIONS handled |
| CSRF Token | ❌ Not implemented | Not needed with header-based auth |

### 4. Sensitive Action Protections

| Action | Method | Protection |
|--------|--------|------------|
| Login | POST | Rate-limited, JWT-based |
| Password change | POST | Requires valid access token |
| Payment creation | POST | Requires valid access token + rate limited |
| Payment verification | POST | Requires valid access token |
| Reservation creation | POST | Requires valid access token |
| Support ticket creation | POST | Requires valid access token |
| Campaign management | POST/PUT/DELETE | Requires valid access token + permission |
| Account deletion | POST | Requires valid access token |

### 5. CSRF Risk Assessment

| Attack Vector | Feasibility | Mitigation |
|---------------|-------------|------------|
| Attacker site makes POST request | Low | Browser requires valid JWT in Authorization header — attacker cannot read victim's token |
| Attacker uses victim's saved session | Low | No session cookies used; tokens are short-lived (15 min) |
| Attacker uses form auto-submit | Low | Form submissions cannot set Authorization header |
| Attacker uses XHR/fetch with credentials | Low | CORS prevents cross-origin reads; preflight requires explicit server opt-in |

## Risk Assessment

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 0 | — |
| Low | 0 | — |

## Conclusion

**CSRF risk is effectively mitigated** by the stateless JWT authentication design. Since the application does not rely on cookies or browser-managed credentials for API authentication, traditional CSRF attacks (which exploit automatic cookie attachment) are not viable.

The access token must be explicitly attached to each request via the `Authorization: Bearer` header. A cross-origin attacker's page cannot read the victim's JWT from the legitimate application's storage (e.g., `localStorage` or `sessionStorage`) due to same-origin policy, and cannot forge the Authorization header without the token value.

**No CSRF-specific countermeasures (tokens, SameSite cookies, double-submit cookies) are required** for the current authentication architecture.

## Recommendations

1. **Maintain header-based auth**: Never switch to cookie-based authentication without adding CSRF tokens
2. **Production CORS**: Ensure `CORS_ORIGIN` is set to specific allowed origins (comma-separated) in production
3. **Short token lifetimes**: Current 15-min access tokens limit window of any potential token exfiltration
4. **Consider adding `Cross-Origin-Opener-Policy`** header for additional cross-origin isolation
