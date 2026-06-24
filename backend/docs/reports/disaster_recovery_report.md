# Disaster Recovery Report — Elixir & Oak

## Status: PLAN DOCUMENTED (scenarios require Docker host)

> Generated: 2026-06-24

---

## 1. Database Backup & Restore

### Strategy
| Aspect | Configuration |
|--------|--------------|
| Database | PostgreSQL 16 (Docker container) |
| Volume | `pgdata` named volume (declared in `docker-compose.yml`) |
| Backup command | `docker exec <postgres_container> pg_dump -U postgres elixir_oak > backup.sql` |
| Restore command | `cat backup.sql \| docker exec -i <postgres_container> psql -U postgres elixir_oak` |

### Automated Backup (Recommended)
- Use `pg_cron` or OS-level cron with:
  ```bash
  # Daily backup at 2am, keep 7 days
  0 2 * * * docker exec postgres pg_dump -U postgres elixir_oak > /backups/elixir_oak_$(date +\%Y\%m\%d).sql
  find /backups -name "elixir_oak_*.sql" -mtime +7 -delete
  ```

---

## 2. Failure Recovery Scenarios

### Scenario A: Backend Container Restart
| Step | Command | Expected Result |
|------|---------|-----------------|
| 1. Stop backend | `docker compose stop backend` | Container stops |
| 2. Verify health check fails | `curl localhost:3000/health` | Connection refused |
| 3. Start backend | `docker compose start backend` | Container starts |
| 4. Wait for health | Wait 30s (health check start period) | `GET /health` → 200 OK |
| 5. Verify data integrity | `GET /api/v1/menu/public` | Returns cached data |

**Impact**: ~30s downtime during restart. Redis cache serves read traffic immediately.

### Scenario B: PostgreSQL Restart
| Step | Command | Expected Result |
|------|---------|-----------------|
| 1. Stop postgres | `docker compose stop postgres` | Backend loses connection |
| 2. Backend behavior | Prisma throws `Can't reach database server` | 503 on /ready, degraded reads from Redis |
| 3. Start postgres | `docker compose start postgres` | Backend reconnects via Prisma |
| 4. Verify | `GET /api/v1/ready` | `database: connected` |

**Impact**: All write operations fail during downtime. Reads from cache still work.

### Scenario C: Redis Restart
| Step | Command | Expected Result |
|------|---------|-----------------|
| 1. Stop redis | `docker compose stop redis` | Backend loses cache |
| 2. Backend behavior | All Redis calls fail silently (try/catch) | Backend falls through to database queries |
| 3. Start redis | `docker compose start redis` | Redis reconnects |
| 4. Verify | First request repopulates cache | Cache rehydrated within 300s TTL |

**Impact**: Increased database load until cache repopulates. No data loss.

### Scenario D: Full Stack Restart
| Step | Command | Expected Result |
|------|---------|-----------------|
| 1. Full restart | `docker compose down && docker compose up -d` | All containers rebuild |
| 2. Verify health | Wait for health checks | All 3 services healthy |

**Impact**: ~2min total downtime. Order in `docker-compose.yml`: postgres→redis→backend.

### Scenario E: WebSocket Reconnect
| Step | Expected Client Behavior |
|------|------------------------|
| 1. Server restart | Socket.IO client fires `disconnect` event |
| 2. Client auto-reconnect | Socket.IO built-in reconnection (configurable delay) |
| 3. Re-auth | Client re-sends JWT via `handshake.auth.token` |
| 4. Room re-join | Client rejoins `user:{userId}` room |

---

## 3. Data Integrity Safeguards

| Mechanism | Description |
|-----------|-------------|
| Atomic stock consumption | `updateMany` with `stockConsumedAt: null` claim prevents double-consumption |
| Order creation lock | Redis distributed lock prevents duplicate checkout |
| Payment idempotency | `WebhookEvent` table prevents duplicate webhook processing |
| Prisma transactions | All multi-step writes wrapped in `$transaction` |
| Soft deletes | Menu items, ingredients, suppliers use `isDeleted` flag |

---

## 4. Monitoring & Alerting

| Metric | Source | Recommended Action |
|--------|--------|-------------------|
| `health` endpoint OK | `GET /api/v1/health` | Alert if non-200 for >30s |
| `ready` endpoint DB status | `GET /api/v1/ready` | Alert if database not connected |
| Container restarts | `docker ps` / Docker events | Alert on >3 restarts in 5min |
| Disk usage (pgdata volume) | `docker system df` | Alert if >80% |
| Redis memory | `docker exec redis redis-cli INFO memory` | Alert if >80% maxmemory |

---

## 5. Recovery Time Objectives

| Scenario | RTO (Target) | RPO (Target) |
|----------|-------------|-------------|
| Backend crash | <1 min | 0 (stateless) |
| DB crash | <2 min | <1 min (WAL) |
| Redis crash | <30s | 0 (cache only) |
| Full stack failure | <5 min | <1 min |
| Data corruption | <30 min | <24h (daily backup) |

---

## Disaster Recovery Verdict

| Scenario | Status | Notes |
|----------|--------|-------|
| Backend restart Plan | ✅ DOCUMENTED | Stateless, auto-heals |
| PostgreSQL restart Plan | ✅ DOCUMENTED | Read degradation via cache |
| Redis restart Plan | ✅ DOCUMENTED | Silent fallback to DB |
| Full stack restart Plan | ✅ DOCUMENTED | Defined in docker-compose |
| WebSocket reconnect Plan | ✅ DOCUMENTED | Socket.IO auto-reconnect |
| Backup procedure | ⚠️ DOCUMENTED | Manual `pg_dump` — automation recommended |
| DR drill execution | ⏳ DEFERRED | Requires Docker host |

**DISASTER RECOVERY: PLAN DOCUMENTED** — All recovery scenarios documented. Execution requires Docker host.
