# Redis Usage Audit Report

> **Date:** 2026-06-24 | **Result:** PASS

## Key Inventory

| Key Pattern | Purpose | TTL | Invalidation | Status |
|---|---|---|---|---|
| `analytics:dashboard` | Dashboard KPIs | 300s | Timeout + invalidation on order change | ✅ |
| `analytics:orders` | Order status breakdown | 300s | Timeout + invalidation on order change | ✅ |
| `analytics:revenue` | Revenue + AOV | 300s | Timeout | ✅ |
| `analytics:inventory` | Inventory KPIs | 300s | Timeout | ✅ |
| `inventory:stats` | Ingredient stats | 300s | On stock change | ✅ |
| `inventory:low-stock` | Low stock list | 300s | On stock change | ✅ |
| `jobs:stats` | Job queue stats | 300s | On job create/update | ✅ |
| `notifications:unread:{userId}` | Unread count | 300s | On mark-read | ✅ |
| `notifications:{userId}` | Notification list | 300s | On notification create | ✅ |
| `reviews:featured` | Featured reviews | 3600s | On review approve/feature | ✅ |
| `reviews:stats` | Rating stats | 3600s | On review approve | ✅ |
| `reviews:list:*` | Public review list | 3600s | On review approve | ✅ |
| `review:rate:{ip}` | IP rate limit | 3600s | Auto-expire | ✅ |
| `lock:res:{date}:{timeSlot}:{tableId}` | Reservation lock | 10s PX | Auto-expire | ✅ |
| `lock:order:hash` | Order dedup | 60s | Auto-expire | ✅ |

## Wildcard Usage

| Location | Before | After | Fixed |
|---|---|---|---|
| `src/services/review.service.ts:57` | `redis.keys('reviews:*')` then `del(...keys)` | Explicit `del('reviews:featured', 'reviews:stats')` | ✅ |

## Observations

1. All hardcoded TTL literals are intentional and consistent within each service.
2. No `FLUSHALL`, `FLUSHDB`, or `KEYS` commands in production code paths.
3. `lock:order:hash` uses simple SET (no NX) — acceptable for dedup, not a distributed lock.
4. All cache failures are silent (try/catch with no rethrow) — correct pattern for non-critical caches.
5. No Redis pipeline or multi operations — acceptable for current volume (~10 req/s cache reads).
