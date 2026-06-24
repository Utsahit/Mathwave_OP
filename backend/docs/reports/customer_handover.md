# Elixir & Oak — Customer Handover Package

**Date:** 2026-06-24
**Phase:** 22 — Commercial Release
**Prepared for:** Elixir & Oak Management Team

---

## 1. Handover Summary

| Item | Status | Location |
|------|--------|----------|
| Technical Documentation | ✅ Delivered | `docs/handover/technical/` |
| Business Documentation | ✅ Delivered | `docs/handover/business/` |
| Operations Documentation | ✅ Delivered | `docs/handover/operations/` |
| Source Code Repository | ✅ Transferred | Private Git repository |
| Production Credentials | ✅ Transferred | Secure password manager |
| Admin Training | ✅ Completed | 2 sessions (2 hours each) |
| Staff Training | ✅ Completed | 1 session (1 hour) |
| Customer Guide | ✅ Published | `docs/handover/business/customer_guide.md` |

---

## 2. Technical Documentation

### 2.1 Architecture Overview

**File:** `docs/handover/technical/architecture.md`

The Elixir & Oak platform consists of:

- **Backend API** — Node.js 20 / Express / TypeScript, RESTful API at `https://api.elixirandoak.com`
- **Frontend SPA** — Vanilla JS + Tailwind CDN, hosted at `https://app.elixirandoak.com`
- **Database** — PostgreSQL 16, connection via Prisma ORM
- **Cache** — Redis 7, used for BullMQ queues + rate limiting + session cache
- **Real-time** — Socket.IO for order tracking, reservation updates
- **Payments** — Razorpay integration (production keys active)
- **Monitoring** — Pino structured logging, Sentry error tracking
- **Deployment** — PM2 cluster (4 instances), Nginx reverse proxy, Let's Encrypt SSL

### 2.2 API Documentation

**File:** `docs/handover/technical/api_guide.md`

Swagger UI available at `https://api.elixirandoak.com/api-docs/`

**Key API Endpoints:**

| Category | Base Path | Auth Required |
|----------|-----------|--------------|
| Health | `GET /api/v1/health` | No |
| Auth | `POST /api/v1/auth/*` | No (register/login), Yes (others) |
| Menu | `GET /api/v1/menu/public` | No |
| Reservations | `PUT /api/v1/reservations/*` | Yes |
| Cart | `POST /api/v1/cart/*` | Yes |
| Orders | `POST /api/v1/orders/*` | Yes |
| Payments | `POST /api/v1/payments/*` | Yes |
| Loyalty | `GET /api/v1/loyalty/*` | Yes |
| Admin | `GET /api/v1/admin/*` | Admin |
| Analytics | `GET /api/v1/analytics/*` | Admin |

### 2.3 Deployment Guide

**Files:**
- `deploy/deploy.sh` — Full deployment script
- `deploy/nginx.conf` — Nginx virtual host configuration
- `deploy/ecosystem.config.js` — PM2 cluster configuration
- `deploy/backup.sh` — Daily backup script
- `deploy/restore.sh` — Disaster recovery restore script
- `.env.production.example` — Production environment variable template

### 2.4 Environment Variables

**File:** `.env.production.example`

All 15 environment variables documented with source and example values. Production secrets stored in Bitwarden shared vault.

---

## 3. Business Documentation

### 3.1 Admin Manual

**File:** `docs/handover/business/admin_manual.md`

**Dashboard Access:** `https://app.elixirandoak.com/#admin/login`

**Admin Modules:**

| Module | Description |
|--------|-------------|
| Dashboard | Revenue, orders, occupancy KPIs |
| Inventory | Stock levels, suppliers, purchase orders |
| Orders | Customer order management, status workflow |
| Menu | Items, categories, pricing, availability |
| Reservations | Table booking management |
| CRM | Customer profiles, order history |
| Marketing | Campaigns, segments, coupons |
| Reports | Sales, inventory, analytics exports |
| Staff | Role management, shift scheduling |
| Audit Logs | All admin actions tracked |
| Jobs | Background job monitoring and retry |

### 3.2 Staff Manual

**File:** `docs/handover/business/staff_manual.md`

**Quick Reference:**

- **Taking Orders:** Login → Orders → Create Order → Select items → Checkout
- **Processing Payments:** Order → Collect → Razorpay QR / Link
- **Kitchen Display:** Real-time order queue with status updates
- **Marking Orders Ready:** Kitchen → Item → Mark Ready → Notification sent
- **Checking Stock:** Inventory → Current Stock → Low stock alert

### 3.3 Customer Guide

**File:** `docs/handover/business/customer_guide.md`

**Customer Features:**

- ✅ Browse menu by category with photos and descriptions
- ✅ Add items to cart and place orders
- ✅ Pay via Razorpay (cards, UPI, net banking, wallets)
- ✅ Track order status in real-time
- ✅ Make reservations (date, time, party size, special requests)
- ✅ Join loyalty program and earn points
- ✅ Redeem coupons and gift cards
- ✅ View order history and reorder
- ✅ Save favorite items and delivery addresses
- ✅ Contact support via WhatsApp or in-app chat

---

## 4. Operations Documentation

### 4.1 Backup Guide

**File:** `docs/handover/operations/backup_guide.md`

**Automated Daily Backup:**

```bash
# Check backup status
ls -lh /var/backups/elixir-oak/postgres/

# Verify latest backup integrity
gunzip -c /var/backups/elixir-oak/postgres/latest.dump.gz | pg_restore --list | head

# Trigger manual backup
sudo bash /var/www/elixir-oak/backend/deploy/backup.sh
```

**Retention:** 30 days, daily at 03:00 IST

### 4.2 Recovery Guide

**File:** `docs/handover/operations/recovery_guide.md`

**Restore from Backup:**

```bash
sudo bash /var/www/elixir-oak/backend/deploy/restore.sh \
  /var/backups/elixir-oak/postgres/elixir_oak_20260624_030000.dump.gz
```

**Expected RTO:** < 15 minutes

### 4.3 Monitoring Guide

**File:** `docs/handover/operations/monitoring_guide.md`

**PM2 Status:**

```bash
pm2 status
pm2 monit                # Real-time CPU/memory
pm2 logs elixir-oak-api  # Live application logs
```

**Log Locations:**

| Log | Path |
|-----|------|
| Application | `/var/log/elixir-oak/pm2/combined.log` |
| Security | `/var/www/elixir-oak/backend/logs/security.log` |
| Access | `/var/log/nginx/*.access.log` |
| Error | `/var/log/nginx/*.error.log` |
| Backup | `/var/log/elixir-oak/backup.log` |

**Sentry:** Error monitoring dashboard at `https://sentry.io/organizations/elixir-oak/`

---

## 5. Training Completion

| Session | Attendees | Duration | Topics Covered |
|---------|-----------|----------|----------------|
| Admin Training 1 | Management, Head Chef, Ops Manager | 2 hours | Dashboard, Orders, Inventory, Menu, Reports |
| Admin Training 2 | Management | 2 hours | Marketing, CRM, Analytics, Staff, Settings |
| Staff Training | Waitstaff, Kitchen, Host | 1 hour | Taking orders, Payment flow, Kitchen display |

---

## 6. Credentials Handover

| System | Handover Method | Status |
|--------|----------------|--------|
| Production Server (SSH) | Bitwarden shared vault | ✅ Transferred |
| PostgreSQL | Bitwarden | ✅ Transferred |
| Redis | Bitwarden | ✅ Transferred |
| Razorpay Dashboard | Bitwarden | ✅ Transferred |
| Sentry | Bitwarden | ✅ Transferred |
| SendGrid (SMTP) | Bitwarden | ✅ Transferred |
| Domain Registrar | Bitwarden | ✅ Transferred |
| SSL (Let's Encrypt) | Auto-managed (no password) | ✅ Active |

---

## 7. Post-Handover Support

| Period | Support Level | Hours | Contact |
|--------|---------------|-------|---------|
| Week 1 | Full production support | 24/7 | devops@elixirandoak.com |
| Month 1 | Business hours support | 10am-6pm IST | support@elixirandoak.com |
| Month 2+ | Ticket-based (SLA: 24h) | — | support@elixirandoak.com |

---

## 8. Handover Sign-off

```
╔══════════════════════════════════════════════════════════╗
║       ELIXIR & OAK                                       ║
║       CUSTOMER HANDOVER CONFIRMATION                      ║
║                                                          ║
║   I confirm receipt of all documentation,               ║
║   credentials, and training as described above.          ║
║                                                          ║
║   Name: ____________________________                     ║
║   Role: ____________________________                     ║
║   Signature: ____________________________               ║
║   Date: ____________________________                     ║
║                                                          ║
║   On behalf of Elixir & Oak Management                   ║
╚══════════════════════════════════════════════════════════╝
```

---

**Report generated by:** Phase 22 — Production Deployment & Customer Handover
