# Elixir & Oak — Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (HTTPS)                      │
│  app.elixirandoak.com  ←  SPA (Vanilla JS + Tailwind)    │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                 Nginx Reverse Proxy :443                  │
│  • TLS 1.2/1.3     • CSP/HSTS/X-Frame-Options           │
│  • HTTP/2          • Static asset caching (30d)          │
│  • WebSocket proxy • Rate limiting (upstream)            │
└──────────┬──────────────────────────────────┬───────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────────┐       ┌──────────────────────────┐
│   PM2 Cluster x4     │       │   Static Files           │
│   localhost:3000      │       │   /var/www/elixir-oak/   │
│                      │       │   frontend/              │
│  ┌────┐ ┌────┐       │       └──────────────────────────┘
│  │ P1 │ │ P2 │       │
│  └────┘ └────┘       │
│  ┌────┐ ┌────┐       │
│  │ P3 │ │ P4 │       │
│  └────┘ └────┘       │
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐ ┌─────────┐
│Postgres │ │  Redis  │
│  :5432   │ │  :6379   │
│  Prisma  │ │ BullMQ   │
│  ORM     │ │ Rate Lim │
└─────────┘ └─────────┘
```

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 20 LTS |
| Language | TypeScript | 5.4 |
| Framework | Express | 4.19 |
| Database | PostgreSQL | 16 |
| ORM | Prisma | 5.14 |
| Cache | Redis | 7 |
| Queue | BullMQ | 5.7 |
| Auth | JWT (jsonwebtoken) | 9.0 |
| Payment | Razorpay | 2.9 |
| Real-time | Socket.IO | 4.7 |
| Validation | Zod | 3.23 |
| Logging | Pino | 9.1 |
| Errors | Sentry | 7.114 |
| Security | Helmet | 7.1 |
| Rate Limit | express-rate-limit + rate-limit-redis | |

## API Design

- RESTful JSON API under `/api/v1/`
- 180+ endpoints across 30 route modules
- Swagger documentation at `/api-docs`
- All routes authenticated via `requireAuth()` middleware (except health + public menu)
- Admin routes protected by `requireAdmin()`
- Zod validation on all request bodies
- Pagination on all list endpoints (cursor-based + offset)

## Data Flow

1. Client → HTTPS → Nginx → PM2 → Express
2. Express validates with Zod → checks JWT → processes request
3. Prisma queries PostgreSQL (with explicit `select()` — never `select *`)
4. Redis caches frequent reads (menu, categories, branch data)
5. BullMQ queues async work (notifications, analytics, backups)
6. Socket.IO pushes real-time updates (order status, reservations)
7. Razorpay handles payment lifecycle (webhook → signature verify → order update)
8. Pino logs to file + Sentry captures errors
