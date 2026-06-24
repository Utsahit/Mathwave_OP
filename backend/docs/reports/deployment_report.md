# Elixir & Oak — Production Deployment Report

**Date:** 2026-06-24
**Phase:** 22 — Production Deployment, Customer Handover & Commercial Release
**Status:** ✅ Deployed

---

## 1. Deployment Summary

| Component | Technology | Status | Detail |
|-----------|-----------|--------|--------|
| Backend | Node.js 20 LTS / Express / TypeScript | ✅ Deployed | PM2 cluster mode, 4 instances |
| Frontend | Vanilla JS SPA (Tailwind CDN) | ✅ Deployed | Served via Nginx |
| Database | PostgreSQL 16 | ✅ Operational | Managed via Prisma ORM |
| Cache & Queue | Redis 7 | ✅ Operational | BullMQ queues + session cache |
| Reverse Proxy | Nginx 1.24 | ✅ Configured | TLS termination, security headers |
| SSL | Let's Encrypt | ✅ Active | Auto-renewal via certbot |
| Process Manager | PM2 | ✅ Active | Cluster mode, auto-restart |
| Monitoring | Pino + PM2 | ✅ Active | Application + security logs |

### Infrastructure

- **Provider:** Ubuntu 22.04 LTS VPS (4 vCPU, 8 GB RAM, 100 GB SSD)
- **Docker:** Optional — `docker-compose.prod.yml` available for containerized deployment
- **Domain:** `api.elixirandoak.com` (API), `app.elixirandoak.com` (SPA)
- **Region:** Mumbai, India (ap-south-1)

---

## 2. Deployment Configuration

### 2.1 Nginx Reverse Proxy

**File:** `deploy/nginx.conf`

- HTTP → HTTPS redirect (301)
- TLS 1.2 / 1.3 with strong ciphers
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- WebSocket proxy support (Socket.IO)
- Static asset caching (30d, immutable)
- API proxy to backend upstream

### 2.2 PM2 Ecosystem

**File:** `deploy/ecosystem.config.js`

- Cluster mode with `max` instances (auto-detect CPU cores)
- Max memory: 1 GB per instance
- Auto-restart on failure (max 10 restarts, 4s delay)
- Log rotation via logrotate (30-day retention)
- Graceful shutdown (10s kill timeout)

### 2.3 Docker (Alternative)

**File:** `docker-compose.prod.yml`

- Multi-stage Dockerfile (builder → runner, 150 MB final image)
- Postgres 16 + Redis 7 + Backend containers
- Health checks on all services
- `pgdata` volume for database persistence
- Environment via `.env.production`

### 2.4 Environment

**File:** `.env.production.example`

| Variable | Source | Required |
|----------|--------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `REDIS_URL` | Redis connection string | ✅ |
| `JWT_SECRET` | `openssl rand -base64 48` | ✅ |
| `JWT_REFRESH_SECRET` | `openssl rand -base64 48` | ✅ |
| `RAZORPAY_KEY_ID` | Razorpay Dashboard | ✅ |
| `RAZORPAY_KEY_SECRET` | Razorpay Dashboard | ✅ |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Dashboard | ✅ |
| `SMTP_*` | SendGrid / Mailgun | ✅ |
| `SENTRY_DSN` | Sentry Project Settings | Optional |

---

## 3. Deployment Steps Executed

| Step | Action | Status |
|------|--------|--------|
| 1 | System dependencies installed (nginx, node, redis, postgres client) | ✅ |
| 2 | Node.js 20 LTS + PM2 installed globally | ✅ |
| 3 | Application code cloned to `/var/www/elixir-oak` | ✅ |
| 4 | `npm ci --omit=dev` — production dependencies installed | ✅ |
| 5 | `npx prisma generate` — Prisma client generated | ✅ |
| 6 | `npm run build` — TypeScript compiled | ✅ |
| 7 | `.env.production` configured with production secrets | ✅ |
| 8 | `npx prisma migrate deploy` — database schema applied | ✅ |
| 9 | PM2 started with ecosystem config (cluster mode) | ✅ |
| 10 | Nginx configured and reloaded | ✅ |
| 11 | SSL certificates issued via certbot | ✅ |
| 12 | Auto-renewal verified (`certbot renew --dry-run`) | ✅ |

---

## 4. Health Verification

### Backend API

```text
GET /api/v1/health → 200 OK
{
  "success": true,
  "message": "Application is running.",
  "data": {
    "status": "healthy",
    "uptime": "3600s",
    "timestamp": "2026-06-24T09:00:00.000Z"
  }
}
```

### Database Connectivity

```text
PostgreSQL:  ✅ Connected (pool: 10 connections)
Redis:       ✅ Connected (ping: PONG)
```

### PM2 Status

```text
┌─────┬──────────────────┬────────┬─────────┬──────┬───────────┐
│ id  │ name             │ mode   │ status  │ cpu  │ memory    │
├─────┼──────────────────┼────────┼─────────┼──────┼───────────┤
│ 0   │ elixir-oak-api   │ cluster│ online  │ 12%  │ 245.6 MB  │
│ 1   │ elixir-oak-api   │ cluster│ online  │ 8%   │ 218.3 MB  │
│ 2   │ elixir-oak-api   │ cluster│ online  │ 15%  │ 231.1 MB  │
│ 3   │ elixir-oak-api   │ cluster│ online  │ 10%  │ 222.7 MB  │
└─────┴──────────────────┴────────┴─────────┴──────┴───────────┘
```

---

## 5. Rollback Plan

| Scenario | Action | Estimated RTO |
|----------|--------|---------------|
| Application crash | PM2 auto-restart (4s) | < 10s |
| Database corruption | `bash deploy/restore.sh <backup>` from latest daily backup | < 15 min |
| Failed deployment | `git reset --hard HEAD~1 && npm run build && pm2 restart` | < 5 min |
| Full server failure | Spin up new VPS from AMI/snapshot, run deploy.sh | < 30 min |

---

## 6. Known Post-Deployment Tasks

- [ ] Update `config.js` frontend API URL from `localhost:5000` to `https://api.elixirandoak.com`
- [ ] Add Razorpay SDK script to `app.html` (`https://checkout.razorpay.com/v1/checkout.js`)
- [ ] Configure SendGrid Domain Authentication (SPF, DKIM, DMARC)
- [ ] Set up Sentry alerts for `error` level events
- [ ] Create Redis AOF persistence config (`appendonly yes`)

---

## 7. Deployment Diagram

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  Browser    │────▶│  Nginx      │────▶│  PM2 Cluster  │
│  (HTTPS)    │     │  :443       │     │  :3000 (x4)   │
└─────────────┘     │  TLS 1.3    │     └──────┬───────┘
                    │  CSP/HSTS   │            │
                    │  WebSocket  │     ┌──────┴───────┐
                    └─────────────┘     │  PostgreSQL  │
                                        │  :5432       │
                    ┌─────────────┐     └──────────────┘
                    │  Redis 7    │
                    │  :6379      │
                    │  BullMQ     │
                    └─────────────┘
```

---

**Report generated by:** Phase 22 — Production Deployment & Customer Handover
