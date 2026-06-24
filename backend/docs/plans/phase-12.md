# Phase 12 Implementation Plan: Notifications, Audit Logging & Background Jobs

## Objectives
Implement a centralized event-driven notification system with email notifications, in-app notifications, audit trail logging, background job processing, scheduled tasks, retry mechanisms, and notification preferences.

All functionality must comply with the 2-second performance policy.

## Schema Changes
- `NotificationType` enum, `NotificationChannel` enum — enhanced `Notification` model
- `NotificationPreference` model (userId @unique, orderUpdates, reservationUpdates, marketingEmails)
- `JobStatus` enum, `JobQueue` model (type, payload, status, attempts, lastError)

## Permissions
- `notification:view`, `notification:update`, `audit:view`, `job:view`, `job:retry`
- ADMIN: all; MANAGER: view + notification:update; STAFF: notification:view

## Services
- **notification.service.ts** — create, send, markRead, list, preferences, bulk
- **audit.service.ts** — logCreate, logUpdate, logDelete, logStatusChange
- **queue.service.ts** — enqueue, processJob, retryFailedJobs (SEND_EMAIL, LOW_STOCK_ALERT, DAILY_ANALYTICS, NEWSLETTER_SEND)
- **scheduler.service.ts** — cron: 5min low stock, hourly retry, daily analytics + cart cleanup

## Routes
- `/api/v1/notifications` — 6 endpoints
- `/api/v1/admin/audit` — 1 endpoint
- `/api/v1/admin/jobs` — 3 endpoints

## Redis Strategy
- `notifications:unread:{userId}`, `jobs:stats` — TTL 300s, exact-key invalidation

## Performance Requirements
- No N+1 queries, explicit Prisma `select()`, pagination on all lists
- Redis exact-key invalidation only
- Email sending queued, never blocking requests
