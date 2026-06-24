# System Metrics Report

## Source Code Metrics

| Metric | Count | Source |
|--------|-------|--------|
| Total Route Handlers | 217 | `src/routes/` (110 GET, 57 POST, 31 PUT, 1 PATCH, 18 DELETE) |
| Total Route Files | 37 | `src/routes/*.ts` |
| Total Models (Prisma) | 57 | `prisma/schema.prisma` |
| Total Permissions | 88 | `prisma/seed.ts` (permissionsList) |
| Total Services | 50 | `src/services/*.service.ts` |
| Total Controllers | 39 | `src/controllers/*.controller.ts` |
| Total Middleware | 7 | `src/middleware/` |
| Total Source Files | ~200+ | `src/` directory |

## Test Metrics

| Metric | Count |
|--------|-------|
| Test Files | 47 |
| Describe Blocks | 214 |
| It Blocks | 394 |
| Security Test Files | 5 (RBAC, SQLi, XSS, WebSocket, Rate limit) |

## Infrastructure Metrics

| Metric | Count |
|--------|-------|
| Redis Key Patterns | ~46 across 17+ prefixes |
| Redis Cache Categories | auth, analytics, notifications, recommendations, mobile, loyalty, segment, rl, branch, order, reports, jobs, security, reviews, inventory, menu, lock, availability, contact, review |
| Scheduled Jobs | 12 (5 intervals: 5min, hourly, daily, weekly, monthly) |
| Job Queue Actions | LOW_STOCK_ALERT, DAILY_ANALYTICS, SEND_REPORT_EMAIL |

## WebSocket Metrics

| Metric | Count |
|--------|-------|
| Namespaces | 2 (/kitchen, /orders) |
| Unique Events | 9 (JOIN_ORDER_ROOM, ORDER_CONFIRMED, TICKET_STARTED, ORDER_PREPARING, TICKET_COMPLETED, ORDER_READY, ORDER_OUT_FOR_DELIVERY, ORDER_DELIVERED, ORDER_CANCELLED) |
| `.emit()` Calls | 4 (in realtime.service.ts) |

## Security Metrics

| Metric | Count |
|--------|-------|
| User Roles | 4 (ADMIN, MANAGER, STAFF, CUSTOMER) |
| Permissions | 88 |
| Docs Reports | 23 (11 Phase 18 + 13 Phase 19) |
| Critical Vulns (npm audit) | 0 |
| High Vulns (npm audit) | 2 (tar transitive, build-time only) |
| Moderate Vulns (npm audit) | 22 (js-yaml, uuid — dev-only) |

## Build Metrics

| Check | Status |
|-------|--------|
| TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| Lint (`npm run lint`) | ✅ 54 pre-existing (53 `no-explicit-any`, 1 `no-namespace`) |
| Build (`npm run build`) | ✅ PASS |
| Prisma Validate | ✅ Schema valid |

---

*Generated: Phase 19 — System Metrics*
