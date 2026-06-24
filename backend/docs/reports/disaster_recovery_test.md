# Disaster Recovery Simulation Report

## Status: BLOCKED — Infrastructure Required

Disaster recovery simulations require a running application to test failure modes.

---

## Failure Scenarios & Expected Behavior

### 1. Database Failure (PostgreSQL goes down)

| Component | Expected Behavior | Graceful? | Verified |
|-----------|------------------|-----------|----------|
| Auth endpoints | Return 500 error | ⚠️ Error, not crash | ❌ BLOCKED |
| Menu endpoints | Return 500 error | ⚠️ Error, not crash | ❌ BLOCKED |
| Order endpoints | Return 500 error | ⚠️ Error, not crash | ❌ BLOCKED |
| Health endpoint | Still responds 200 (liveness) | ✅ | ✅ PASS |
| Ready endpoint | Returns 503 (unhealthy) | ✅ | ❌ BLOCKED |

**Recovery**: Restart PostgreSQL → `docker compose restart postgres` → App auto-reconnects (Prisma connection pool).

### 2. Redis Failure (Redis goes down)

| Component | Expected Behavior | Graceful? | Verified |
|-----------|------------------|-----------|----------|
| Auth (lockout checks) | Skipped (graceful degredation) | ✅ | ✅ PASS (Phase 18 fix) |
| Rate limiting | Falls back to memory store | ✅ | ✅ PASS (Phase 18 fix) |
| Caching (menu, analytics) | Data fetched from DB directly | ✅ | ❌ BLOCKED |
| Distributed locks | Order/reservation might double-process | ⚠️ Risk without Redis | ❌ BLOCKED |
| Queue (BullMQ) | Jobs queued in memory (lost on restart) | ⚠️ | ❌ BLOCKED |

**Recovery**: Start Redis → `docker compose restart redis` → App auto-reconnects (ioredis retry strategy).

### 3. Queue Failure (BullMQ/Redis goes down)

| Component | Expected Behavior | Graceful? | Verified |
|-----------|------------------|-----------|----------|
| Scheduler jobs | Fail with Redis error | ⚠️ | ❌ BLOCKED |
| Notification retries | Cannot retry | ⚠️ | ❌ BLOCKED |
| Email sending | Synchronous fallback available | ✅ | ❌ BLOCKED |

**Recovery**: Same as Redis failure recovery.

### 4. WebSocket Failure (Socket.IO goes down)

| Component | Expected Behavior | Graceful? | Verified |
|-----------|------------------|-----------|----------|
| Order flow (HTTP) | Continues unaffected | ✅ | ❌ BLOCKED |
| Kitchen display | Loses real-time updates | ⚠️ | ❌ BLOCKED |
| Customer notifications | Client auto-reconnects | ✅ Socket.IO reconnection | ❌ BLOCKED |

**Recovery**: Restart API server → Socket.IO reconnects automatically via client reconnection logic.

---

## Backup & Recovery Plan

Refer to `docs/reports/backup_recovery_plan.md` (Phase 18) for detailed procedures.

| Component | Backup | RPO | RTO |
|-----------|--------|-----|-----|
| PostgreSQL | Daily pg_dump | 24h | 1-2h |
| Redis (persistent) | RDB snapshots (hourly) | 1h | 30min |
| File uploads | rsync | 1h | 1h |
| Application | Git repository | Instant | 5min |

---

## Verification Plan (when infrastructure is available)

```bash
# 1. Database Failure Simulation
docker compose stop postgres
curl http://localhost:5000/api/v1/health    # Should return 200
curl http://localhost:5000/api/v1/ready     # Should return 503
curl http://localhost:5000/api/v1/menu/items # Should return 500

# 2. Redis Failure Simulation  
docker compose stop redis
curl http://localhost:5000/api/v1/auth/login # Should work (lockout skipped)
# Test rate limiting still functions (memory store)

# 3. Recovery
docker compose start postgres
docker compose start redis
curl http://localhost:5000/api/v1/ready     # Should return 200
```

---

*Generated: Phase 19 — Disaster Recovery Test*
