# Backup & Recovery Strategy

## Document Date
June 2026

## Overview
This document outlines the backup and recovery strategy for the Elixir & Oak platform, covering PostgreSQL database, Redis cache, file uploads, and application configuration.

---

## 1. PostgreSQL Backup Strategy

### Database Details
- **Engine**: PostgreSQL (via Prisma ORM)
- **Host**: Configurable via `DATABASE_URL` env
- **Default Port**: 5432

### Backup Types

| Type | Frequency | Retention | Method |
|------|-----------|-----------|--------|
| Full backup | Daily | 30 days | `pg_dump` |
| WAL archiving | Continuous | 7 days | PostgreSQL WAL |
| Logical backup | Weekly | 90 days | `pg_dump --format=custom` |

### Backup Commands

```bash
# Daily full backup
pg_dump \
  --host=localhost \
  --port=5432 \
  --username=postgres \
  --dbname=elixir_oak \
  --format=custom \
  --file=/backups/postgres/elixir_oak_$(date +%Y%m%d).dump

# Weekly logical backup with schema-only for reference
pg_dump \
  --host=localhost \
  --port=5432 \
  --username=postgres \
  --dbname=elixir_oak \
  --schema-only \
  --file=/backups/postgres/schema_$(date +%Y%m%d).sql

# Restore from custom format dump
pg_restore \
  --host=localhost \
  --port=5432 \
  --username=postgres \
  --dbname=elixir_oak \
  --clean \
  --if-exists \
  /backups/postgres/elixir_oak_20260601.dump
```

### Automation (Cron)

```cron
# Daily backup at 2 AM
0 2 * * * /usr/local/bin/pg_dump [...] > /backups/postgres/elixir_oak_$(date +\%Y\%m\%d).dump

# Cleanup backups older than 30 days
0 3 * * * find /backups/postgres/ -name "*.dump" -mtime +30 -delete
```

---

## 2. Redis Backup Strategy

### Redis Configuration
- **Host**: Configurable via `REDIS_URL` env
- **Default Port**: 6379
- **Data stored**: Rate limit counters, auth lockout, rotated tokens, cached analytics, session metadata

### Persistence Configuration

```conf
# redis.conf
save 900 1       # Save after 900 sec if at least 1 key changed
save 300 10      # Save after 300 sec if at least 10 keys changed
save 60 10000    # Save after 60 sec if at least 10000 keys changed
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
```

### Backup Commands

```bash
# Manual RDB snapshot
redis-cli SAVE
cp /var/lib/redis/dump.rdb /backups/redis/dump_$(date +%Y%m%d).rdb

# Manual AOF rewrite
redis-cli BGREWRITEAOF
```

### Restore

```bash
# Stop Redis
systemctl stop redis

# Replace dump.rdb with backup
cp /backups/redis/dump_20260601.rdb /var/lib/redis/dump.rdb

# Start Redis
systemctl start redis
```

### Cache Repopulation Note
Redis data is **ephemeral** — the application is designed to repopulate caches on demand. Rate limit counters and lockout data will reset on Redis restart. Only the rotated token tracking data (7-day TTL) is non-recoverable but transient.

---

## 3. File Uploads Backup

### Location
`/app/uploads/` (mapped volume in Docker)

### Backup Strategy
```bash
# Daily incremental backup of uploads
rsync -avz --link-dest=/backups/uploads/previous \
  /app/uploads/ \
  /backups/uploads/$(date +%Y%m%d)
```

### Contents
- Menu item images (JPG, JPEG, PNG, WEBP)
- Maximum file size: 5MB
- Typically <100MB total

---

## 4. Application Configuration Backup

### Files to Backup
```bash
# Environment configuration
cp .env /backups/config/.env.$(date +%Y%m%d)

# Docker compose
cp docker-compose.yml /backups/config/docker-compose.$(date +%Y%m%d).yml

# Nginx configuration (if applicable)
cp -r /etc/nginx/ /backups/config/nginx/
```

---

## 5. Recovery Procedures

### Scenario A: Database Corruption

```bash
# 1. Stop application
docker-compose down

# 2. Drop and recreate database
dropdb elixir_oak
createdb elixir_oak

# 3. Restore from latest backup
pg_restore --clean --if-exists --dbname=elixir_oak \
  /backups/postgres/elixir_oak_latest.dump

# 4. Run Prisma (ensures schema matches)
npx prisma migrate deploy

# 5. Restart application
docker-compose up -d
```

**Estimated RTO**: 15-30 minutes (depending on database size)
**Estimated RPO**: Up to 24 hours (daily backup schedule)

### Scenario B: Redis Data Loss

```bash
# 1. Restart Redis (will load RDB/AOF if available)
docker-compose restart redis

# 2. Application caches will repopulate on demand
#    (rate limit counters, lockout data will reset)
```

**Estimated RTO**: 1-2 minutes
**Estimated RPO**: Up to 5 minutes (AOF everysec fsync)

### Scenario C: Complete Server Failure

```bash
# 1. Provision new server with Docker installed

# 2. Restore configuration
cp /backups/config/.env.20260601 .env

# 3. Restore database from latest backup
pg_restore --clean --dbname=elixir_oak \
  /backups/postgres/elixir_oak_latest.dump

# 4. Restore uploads
rsync -avz /backups/uploads/20260601/ /app/uploads/

# 5. Start application
docker-compose up -d

# 6. Run database migrations (if schema changed)
npx prisma migrate deploy
```

**Estimated RTO**: 1-2 hours
**Estimated RPO**: Up to 24 hours

---

## 6. Disaster Recovery Testing Schedule

| Test | Frequency | Success Criteria |
|------|-----------|------------------|
| Database restore | Monthly | Can restore from latest backup, all tests pass |
| Redis rebuild | Monthly | Application recovers from Redis wipe, caches repopulate |
| File restore | Quarterly | Uploaded images serve correctly after restore |
| Full DR drill | Bi-annual | Complete server recovery within 2 hours |

---

## 7. Monitoring & Alerting

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| Backup age | >26 hours | Alert — missed daily backup |
| Backup size anomaly | >20% deviation | Investigate data growth |
| Redis persistence | RDB/AOF write failures | Alert — potential data loss |
| Disk usage | >80% on backup volume | Increase storage or rotate older backups |

---

## 8. Backup Verification

```bash
# Verify database backup integrity
pg_restore --list /backups/postgres/elixir_oak_20260601.dump | head -20

# Verify file backup integrity
find /backups/uploads/ -type f -name "*.webp" | wc -l
```

All backups should be verified within 24 hours of creation to ensure recoverability.
