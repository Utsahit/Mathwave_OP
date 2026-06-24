# Elixir & Oak — Disaster Recovery Guide

---

## Restore PostgreSQL Database

### Prerequisites
- SSH access to the production server
- Backup file available in `/var/backups/elixir-oak/postgres/`
- PostgreSQL client installed

### Steps

```bash
# 1. Identify the backup to restore
ls -lh /var/backups/elixir-oak/postgres/

# 2. Run the restore script
sudo bash /var/www/elixir-oak/backend/deploy/restore.sh \
  /var/backups/elixir-oak/postgres/elixir_oak_20260624_030000.dump.gz
```

The script will:
1. Stop the application (PM2)
2. Drop and recreate the database
3. Restore from the backup file
4. Restart the application

**Expected RTO: < 15 minutes**

### Manual Restore (if script fails)

```bash
# Stop application
pm2 stop elixir-oak-api

# Drop and recreate database
PGPASSWORD="<password>" psql -h 127.0.0.1 -U postgres -d postgres -c "
  SELECT pg_terminate_backend(pg_stat_activity.pid)
  FROM pg_stat_activity
  WHERE pg_stat_activity.datname = 'elixir_oak';
  DROP DATABASE IF EXISTS elixir_oak;
  CREATE DATABASE elixir_oak OWNER postgres;
"

# Restore
gunzip -c /var/backups/elixir-oak/postgres/elixir_oak_20260624_030000.dump.gz | \
  pg_restore -h 127.0.0.1 -U postgres -d elixir_oak -v

# Restart application
pm2 start elixir-oak-api
```

---

## Server Failure

If the entire server is lost:

1. Provision a new VPS (same specs: 4 vCPU, 8 GB RAM, 100 GB SSD)
2. Run the deployment script:
   ```bash
   sudo bash /var/www/elixir-oak/backend/deploy/deploy.sh
   ```
3. Restore the database from the latest backup (stored off-site)
4. Verify all services are healthy

**Expected RTO: < 45 minutes** (with off-site backup)
**Expected RTO: < 2 hours** (if rebuilding from scratch + latest on-server backup)

---

## Application Crash

PM2 auto-restarts crashed processes within 4 seconds. If the application fails repeatedly:

```bash
# Check status
pm2 status

# View logs
pm2 logs elixir-oak-api --lines 100

# Restart
pm2 restart elixir-oak-api

# If still failing, check recent deploys
cd /var/www/elixir-oak
git log --oneline -5
git diff HEAD~1 HEAD
```

---

## Redis Failure

Redis is used for caching and BullMQ queues. If Redis is unavailable:

1. The application falls back to in-memory operation (degraded but functional)
2. BullMQ jobs will retry when Redis recovers
3. Rate limiting reverts to memory store

### Recovery:

```bash
# Check Redis status
redis-cli ping

# Restart Redis
systemctl restart redis-server

# Verify
redis-cli ping  # Should return PONG
```

---

## Nginx / SSL Failure

```bash
# Test configuration
nginx -t

# Reload Nginx
systemctl reload nginx

# Check SSL certs
certbot certificates

# Renew SSL (if expiring)
certbot renew

# Test auto-renewal
certbot renew --dry-run
```

---

## Contact

For unrecoverable issues, contact:
- **DevOps:** devops@elixirandoak.com
- **Support:** support@elixirandoak.com
