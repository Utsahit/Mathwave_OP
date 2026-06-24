# Elixir & Oak — Monitoring Guide

---

## PM2 Process Monitoring

### Dashboard
```bash
pm2 monit
```
Shows real-time CPU, memory, loop delay for each cluster instance.

### Status
```bash
pm2 status
```
Shows online/stopped/errored status for all processes.

### Logs
```bash
pm2 logs elixir-oak-api      # Live tail
pm2 logs elixir-oak-api --lines 200  # Last 200 lines
pm2 logs elixir-oak-api --err        # Errors only
```

---

## Log Files

| Log | Path | Content |
|-----|------|---------|
| Application | `/var/log/elixir-oak/pm2/combined.log` | All API requests + responses |
| Application Out | `/var/log/elixir-oak/pm2/out.log` | Standard output |
| Application Error | `/var/log/elixir-oak/pm2/error.log` | Error output |
| Security | `/var/www/elixir-oak/backend/logs/security.log` | Auth failures, rate limit hits |
| Nginx Access | `/var/log/nginx/api.elixirandoak.com.access.log` | All HTTP requests |
| Nginx Error | `/var/log/nginx/api.elixirandoak.com.error.log` | Nginx errors |
| Backup | `/var/log/elixir-oak/backup.log` | Backup job results |

Logs are rotated daily with 30-day retention (configured in `/etc/logrotate.d/elixir-oak`).

---

## Health Checks

The application exposes health endpoints:

```bash
# Basic health
curl https://api.elixirandoak.com/api/v1/health

# Expected response:
# {"success":true,"message":"Application is running.","data":{"status":"healthy","uptime":"3600s"}}

# System metrics
curl https://api.elixirandoak.com/api/v1/health/system

# Expected: CPU, memory, disk usage, uptime
```

## Sentry Error Tracking

- **Dashboard:** `https://sentry.io/organizations/elixir-oak/`
- Captures all `error` and above log levels
- Includes stack traces, request context, user info
- Alerts configured for critical errors

## Manual Checks (Daily)

```bash
# 1. Is the app running?
pm2 status | grep online

# 2. Is the API responding?
curl -s -o /dev/null -w "%{http_code}" https://api.elixirandoak.com/api/v1/health

# 3. Is the database up?
PGPASSWORD="<password>" pg_isready -h 127.0.0.1

# 4. Is Redis up?
redis-cli ping

# 5. Did backup run last night?
grep "Backup completed" /var/log/elixir-oak/backup.log | tail -1

# 6. Any SSL issues?
certbot certificates | grep "VALID"
```
