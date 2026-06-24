# Background Job Reliability Audit Report

> **Date:** 2026-06-24 | **Result:** PASS

## Architecture

- **Queue:** Prisma `JobQueue` table (no BullMQ/RabbitMQ)
- **Scheduler:** `setInterval` singletons at 3 frequencies (5min, hourly, daily)
- **Processing:** Pull-based via `processNextPending()` and `processJob()`

## Findings

| ID | Finding | Severity | Status | Fix |
|---|---|---|---|---|
| JR-01 | `processJob` race: two workers could claim same job | HIGH | FIXED | Atomic `updateMany` with `status: 'PENDING'` in WHERE |
| JR-02 | No max retry cap — job could retry indefinitely | MEDIUM | FIXED | `MAX_RETRIES = 10`; after cap, status → `FAILED` |
| JR-03 | Scheduler could double-register on hot reload | MEDIUM | FIXED | Singleton `started` boolean guard |
| JR-04 | `checkLowStock` enqueues every 5 min — potential backlog | LOW | DEFERRED | Add dedup check before enqueue |
| JR-05 | `executeJob` has no timeout — a stuck job blocks processing | LOW | DEFERRED | Add Promise.race with timeout wrapper |
| JR-06 | Failed jobs reset to PENDING for retry — works with scheduler | — | PASS | `retryFailedNotifications` in hourly cycle |
| JR-07 | `sendLowStockAlert` creates per-admin notifications in loop | — | PASS | Low volume; acceptable |

## Processing Flow (After Fix)

```
enqueue(job) → status: PENDING
  → scheduler picks → processJob()
    → updateMany(id, PENDING → PROCESSING) [atomic claim]
      → count === 1: executeJob()
        → success: update(id, PROCESSING → COMPLETED)
        → failure: attempt < 10: update(id, → PENDING)
                  attempt >= 10: update(id, → FAILED)
      → count === 0: return null (already claimed)
```

## Job Types

| Type | Handler | Schedule | Retry Strategy |
|---|---|---|---|
| `SEND_EMAIL` | nodemailer SMTP | On-demand | Reset to PENDING |
| `LOW_STOCK_ALERT` | Query + notify admins | Every 5 min | Reset to PENDING |
| `DAILY_ANALYTICS` | Aggregation + notify | Daily | Reset to PENDING |
| `NEWSLETTER_SEND` | Bulk email | On-demand | Reset to PENDING |
