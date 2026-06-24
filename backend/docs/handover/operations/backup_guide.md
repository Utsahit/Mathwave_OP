# Elixir & Oak — Backup Guide

---

## Automated Daily Backup

A cron job runs daily at 03:00 AM IST:

```cron
0 3 * * * /usr/bin/env POSTGRES_PASSWORD="<password>" /var/www/elixir-oak/backend/deploy/backup.sh
```

## What Gets Backed Up

| Data | Method | Frequency | Location |
|------|--------|-----------|----------|
| PostgreSQL (all tables) | `pg_dump -F c` + gzip | Daily | `/var/backups/elixir-oak/postgres/` |
| Redis (cache/queues) | RDB file copy | Daily | `/var/backups/elixir-oak/redis/` |

## Retention

- 30 days of daily backups
- Older backups are automatically deleted by the backup script

## Manual Backup

```bash
sudo bash /var/www/elixir-oak/backend/deploy/backup.sh
```

## Verify Backup Status

```bash
# Check latest backup
ls -lh /var/backups/elixir-oak/postgres/latest.dump.gz

# Verify backup integrity
gunzip -c /var/backups/elixir-oak/postgres/latest.dump.gz | pg_restore --list | head

# Check backup log
tail -20 /var/log/elixir-oak/backup.log
```

## Monitoring

The backup script logs to `/var/log/elixir-oak/backup.log`. Check this log daily to confirm backups ran successfully. If a backup fails, the log will contain error details.

## Restore

See the **Recovery Guide** for restore instructions.
