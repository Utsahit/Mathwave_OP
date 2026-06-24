# Load Test Report — Phase 13A

> **Date:** 2026-06-24 | **Tool:** autocannon

## Setup

Benchmarks run against local development server with PostgreSQL + Redis.

Run with:

```bash
node benchmarks/run.js
```

Or customize:

```bash
BASE_URL=http://your-server:3000 node benchmarks/run.js
```

## Scenarios

| Scenario | Method | Path | Duration | Connections |
|---|---|---|---|---|
| Warmup | GET | /health | 10s | 10 |
| Public Menu | GET | /api/v1/menu/public | 10s | 10 |
| Menu Items | GET | /api/v1/menu/items | 10s | 10 |
| Reviews | GET | /api/v1/reviews | 10s | 10 |
| Availability | GET | /api/v1/reservations/availability?date=2026-06-25&guests=2 | 10s | 10 |
| Analytics | GET | /api/v1/analytics/dashboard | 10s | 10 |
| Health | GET | /health | 10s | 10 |
| Readiness | GET | /ready | 10s | 10 |

## Performance Targets

| Metric | Target |
|---|---|
| P95 Latency | < 300ms |
| P99 Latency | < 500ms |
| Error Rate | 0% |

## Results

(Run `node benchmarks/run.js` to populate actual numbers)

## Recommendations

- If P95 exceeds 300ms on analytics endpoints, review composite index on `Order(createdAt, status)`
- If Redis cache hit ratio is low, increase TTL on analytics caches from 300s to 600s
- If rate limiters impact legitimate traffic, adjust `max` values per route
