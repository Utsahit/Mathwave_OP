# Hardening & Performance Pass — Completion Report

> **Date:** 2026-06-24  
> **Scope:** Pre-Phase 13 audit fixes across Phases 1–12  
> **Status:** ✅ Complete

## Summary

Systematic audit and hardening of all backend services, queries, cache invalidation, security middleware, and schema indexing. No new features — only fixes, optimizations, and verification.

## Fixes Applied

### 1. Scheduler Singleton Guard (`src/services/scheduler.service.ts`)

- **Issue:** `schedulerService.start()` could be called multiple times (e.g., during hot reload), registering duplicate `setInterval` handlers.
- **Fix:** Added `private started = false` guard; `start()` returns early if already running.
- **Cleanup:** `stop()` resets `started = false` and clears all intervals.

### 2. Atomic Job Claim — Race Condition (`src/services/queue.service.ts`)

- **Issue:** `processJob` used read-then-write: `findUnique` to check status, then `update`. Two concurrent calls could both see `status: 'PENDING'` and both proceed.
- **Fix:** Replaced with atomic `updateMany({ where: { id, status: 'PENDING' }, data: { status: 'PROCESSING' } })`. Only the first caller gets `count === 1`; the second sees `count === 0` and returns null.
- **Retry Cap:** Added `MAX_RETRIES = 10`. On failure, if `attempts >= MAX_RETRIES`, job goes to `FAILED`; otherwise it resets to `PENDING` for the next retry cycle.

### 3. WebSocket Connection Limit (`src/services/realtime.service.ts`)

- **Issue:** No upper bound on concurrent Socket.IO connections; resource exhaustion possible.
- **Fix:** Added `maxClients = 200` configurable limit. Both namespaces check `this.io.engine.clientsCount` on connection and disconnect clients when exceeded.
- **Method:** `setMaxClients(max: number)` for runtime configuration.

### 4. Redis Wildcard Invalidation (`src/services/review.service.ts`)

- **Issue:** `await redis.keys('reviews:*')` uses `KEYS` which blocks Redis on large key spaces, doesn't scale with clustering.
- **Fix:** Replaced with two explicit `del()` calls on known keys `reviews:featured` and `reviews:stats`.

### 5. Missing Indexes (`prisma/schema.prisma`)

Added `@@index` declarations for columns used in `ORDER BY` and `WHERE` clauses:

| Model | New Index | Justification |
|---|---|---|
| `Notification` | `@@index([createdAt])` | sort by newest in notification list |
| `StockMovement` | `@@index([createdAt])` | sort by createdAt desc in listStockMovements |
| `JobQueue` | `@@index([processedAt])` | cleanup / analytics queries |

## Verification

- **Job tests:** 11/11 passing (updated failure test to expect `PENDING` with attempts=1 instead of immediate `FAILED`)
- All existing tests continue to pass

## Notes

- `processJob`'s atomic claim via `updateMany` eliminates the read-then-write TOCTOU race entirely.
- WebSocket `clientsCount` is approximate (Socket.IO 4.x); fine for a rate-limiting guard, not a hard cap.
- `reservation-lock.service.ts` already uses correct exact-key Redis operations (no wildcards).
- Auth routes intentionally left with minimal auth on payment/order-public endpoints (webhooks validate via signature, guest orders need no auth); not a security gap.
