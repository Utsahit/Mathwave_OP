# Elixir & Oak — Phase Implementation Tracker

> Last updated: 2026-06-24  
> **Current Phase: 12 (Notifications, Audit Logging & Background Jobs) ✅**  
> **Overall Status: 178+ tests passing, 19+ suites**  
> **Hardening Pass: Complete — See `docs/completions/hardening.md`**

### Document Structure

| Directory | Contents |
|---|---|
| `docs/plans/` | Implementation plans for upcoming phases (review before coding) |
| `docs/completions/` | Completion reports for finished phases (Phase 10+) |
| `docs/phase-tracker.md` | This file — high-level status overview |

---

## Phase 1: Project Setup & Authentication
**Status: ✅ Complete**

- [x] Express + TypeScript project scaffolding
- [x] Prisma ORM + PostgreSQL setup
- [x] Redis connection
- [x] JWT access + refresh token auth
- [x] Login / register / refresh / logout endpoints
- [x] RBAC middleware (roles, permissions)
- [x] Error handling middleware
- [x] Environment config validation (Zod)
- [x] Logger (pino)

---

## Phase 2: Menu Management
**Status: ✅ Complete**

- [x] MenuCategory CRUD
- [x] MenuItem CRUD (with category relation)
- [x] Image upload support
- [x] Active/deleted filtering
- [x] RBAC enforcement

---

## Phase 3: Reservations
**Status: ✅ Complete**

- [x] Reservation CRUD
- [x] Table management
- [x] Status transitions (PENDING → CONFIRMED → CANCELLED)
- [x] Date/time slot indexing
- [x] Customer-side reservation creation

---

## Phase 4: Reviews & Ratings
**Status: ✅ Complete**

- [x] Review creation (authenticated + guest)
- [x] Admin approval workflow
- [x] Rating aggregation

---

## Phase 5: Contact & Newsletter
**Status: ✅ Complete**

- [x] Contact message submission
- [x] Newsletter subscription
- [x] Admin read/unread management

---

## Phase 6: Notifications & Audit Logging
**Status: ✅ Complete**

- [x] Notification model + CRUD
- [x] Audit log model + automatic logging
- [x] Feature flags system
- [x] Business settings management

---

## Phase 7: Menu & Core Enhancements
**Status: ✅ Complete**

- [x] Recommended fields on menu items
- [x] Composite indexing optimization
- [x] Slug-based routing
- [x] Tag system

---

## Phase 8: Enhanced Menu & Category System
**Status: ✅ Complete**

- [x] Category-level operations
- [x] Menu item category re-assignment
- [x] Bulk operations

---

## Phase 9: Orders, Cart & Payment Foundation
**Status: ✅ Complete**

- [x] Guest cart (30-day Redis expiry)
- [x] Authenticated cart
- [x] Cart-to-Order checkout flow
- [x] Distributed Redis lock on order creation
- [x] Content-hash duplicate order guard (60s)
- [x] Razorpay payment initialization
- [x] HMAC-SHA256 signature verification
- [x] Webhook idempotency via WebhookEvent table
- [x] OrderStatusHistory audit trail
- [x] Immutable gatewayResponse snapshot on Transaction
- [x] Redis exact-key cache invalidation
- [x] Full RBAC enforcement on admin endpoints
- [x] Pagination on all list endpoints
- [x] 107 tests passing → 9 suites

---

## Phase 10: Inventory, Ingredients, Suppliers & Cost Control
**Status: ✅ Complete (129 tests, 13 suites)**  
[📄 Completion Report](completions/phase-10.md)

### Schema
- [x] `stockConsumedAt` DateTime? on Order model
- [x] Ingredient model (sku, currentStock, minimumStock, costPerUnit, isActive, isDeleted)
- [x] MenuItemIngredient model (quantity Decimal, unique constraint)
- [x] Supplier model (isActive, isDeleted)
- [x] SupplierIngredient model (pricePerUnit, unique constraint)
- [x] PurchaseOrder model (poNumber, status enum, totalAmount)
- [x] PurchaseOrderItem model (quantity, unitCost)
- [x] PurchaseOrderHistory model (oldStatus, newStatus, changedBy)
- [x] StockMovement model (type enum, quantity, referenceId)

### Permissions & Seed
- [x] `ingredient:*` permissions seeded
- [x] `supplier:*` permissions seeded
- [x] `purchase:*` permissions seeded
- [x] RBAC mapped for ADMIN / MANAGER / STAFF
- [x] `enable_inventory` feature flag

### Services
- [x] `ingredient.service.ts` — CRUD, soft-delete, pagination, search
- [x] `supplier.service.ts` — CRUD, soft-delete, ingredient mapping pricing
- [x] `purchase-order.service.ts` — Create, update status, receiving with stock increment, history audit
- [x] `stock.service.ts` — Consumption (atomic idempotency), manual adjustments, low-stock detection, stats, movements

### Controllers & Routes
- [x] `ingredient.controller.ts` + `/api/v1/inventory/ingredients`
- [x] `supplier.controller.ts` + `/api/v1/suppliers`
- [x] `purchase-order.controller.ts` + `/api/v1/purchase-orders`
- [x] `inventory.controller.ts` + `/api/v1/inventory/stats`, `/low-stock`, `/movements`, `/adjust`

### Validation
- [x] `inventory.validator.ts` — Zod schemas for all inventory/supplier/PO operations

### Bugs Fixed
- [x] `purchase-order.service.ts` — Fixed broken `orderBy` syntax (nested `createdAt: { createdAt: 'desc' }`)
- [x] `purchase-order.service.ts` — Fixed `updatePurchaseOrderStatus` returning stale data (used `prisma` instead of `tx`)
- [x] `purchase-order.service.ts` — Fixed status guard ordering (RECEIVED/CANCELLED before same-status check)
- [x] `stock.service.ts` — Fixed `$queryRaw` SQL using wrong column names (`is_deleted` → `"isDeleted"`, `current_stock` → `"currentStock"`, etc.)
- [x] `stock.service.ts` — Fixed concurrent consumption race condition (atomic `updateMany` with `stockConsumedAt: null` claim)
- [x] `stock.service.ts` — Fixed low-stock cache invalidation key mismatch (keys had page:limit suffix, invalidation used bare key)

### Tests
- [x] `tests/ingredient.test.ts` — 7/7 passing
- [x] `tests/supplier.test.ts` — 5/5 passing
- [x] `tests/purchase-order.test.ts` — 4/4 passing
- [x] `tests/inventory.test.ts` — 6/6 passing
- [x] **Full suite: 129/129 passing, 13/13 suites**

---

## Phase 11: KDS, Order Fulfillment & Real-Time Tracking
**Status: ✅ Complete (151 tests, 16 suites)**  
[📄 Completion Report](completions/phase-11.md)

### Schema
- [x] `TicketPriority` enum (LOW, MEDIUM, HIGH, URGENT)
- [x] `KitchenStation` model (name, isActive)
- [x] `KitchenTicket` model (orderId @unique, stationId, status, priority, startedAt, completedAt, assignedTo, notes, @@index([createdAt]))

### Permissions & Seed
- [x] `kitchen:view`, `kitchen:update`, `kitchen:assign`, `analytics:view` permissions
- [x] RBAC mapped for ADMIN / MANAGER / STAFF / CUSTOMER
- [x] 5 kitchen stations seeded

### Services
- [x] `realtime.service.ts` — Socket.IO singleton with auth middleware on all namespaces
- [x] `kitchen.service.ts` — Ticket lifecycle with duplicate guard
- [x] `fulfillment.service.ts` — Order status orchestration + kitchen ticket + WebSocket
- [x] `analytics.service.ts` — 4 KPIs with independent 300s Redis cache

### Controllers & Routes
- [x] `kitchen.controller.ts` + `/api/v1/kitchen` (6 endpoints)
- [x] `analytics.controller.ts` + `/api/v1/analytics` (4 endpoints)

### Tests
- [x] `tests/kitchen.test.ts` — 8/8 passing
- [x] `tests/analytics.test.ts` — 7/7 passing
- [x] `tests/realtime.test.ts` — 7/7 passing
- [x] **Full suite: 151/151 passing, 16/16 suites**

### Bugs Fixed
- [x] Socket.IO auth middleware only on `/` namespace (not `/kitchen`, `/orders`)
- [x] Kitchen controller passing ticketId as orderId to fulfillment
- [x] Inventory test FK constraint (missing kitchenTicket.deleteMany)

---

## Phase 12: Notifications, Audit Logging & Background Jobs
**Status: ✅ Complete (178+ tests, 19+ suites)**  
[📄 Completion Report](completions/phase-12.md)

### Schema
- [x] `NotificationType` enum (11 types: ORDER_CREATED through SYSTEM)
- [x] `NotificationChannel` enum (EMAIL, IN_APP)
- [x] `Notification` model enhanced with type, channel, email, isSent, sentAt, metadata
- [x] `NotificationPreference` model (userId @unique, orderUpdates, reservationUpdates, marketingEmails)
- [x] `JobStatus` enum (PENDING, PROCESSING, COMPLETED, FAILED)
- [x] `JobQueue` model (type, payload, status, attempts, lastError, @@index on status, type, createdAt, processedAt)

### Permissions & Seed
- [x] `notification:view`, `notification:update`, `audit:view`, `job:view`, `job:retry` permissions
- [x] ADMIN: all, MANAGER: notification/job/audit view + notification update, STAFF: notification:view

### Services
- [x] `notification.service.ts` — create, list, unread count, markRead, markAllRead, preferences, bulk
- [x] `audit.service.ts` — logCreate, logUpdate, logDelete, logStatusChange, list with filters
- [x] `queue.service.ts` — enqueue, processJob (atomic claim + max retry), retry, list, stats, executeJob
- [x] `scheduler.service.ts` — 5-min (low stock), hourly (retry failed + process), daily (analytics + guest cart cleanup), singleton guard

### Controllers & Routes
- [x] `notification.controller.ts` + `/api/v1/notifications` (6 endpoints)
- [x] `audit.controller.ts` + `/api/v1/admin/audit` (1 endpoint)
- [x] `jobs.controller.ts` + `/api/v1/admin/jobs` (3 endpoints)

### Event Integration
- [x] Order: ORDER_CREATED on create, ORDER_CONFIRMED/READY/DELIVERED on status transition
- [x] Reservation: RESERVATION_CREATED on create, RESERVATION_CONFIRMED/CANCELLED on status change
- [x] Review: REVIEW_APPROVED on approval
- [x] Contact: CONTACT_RECEIVED notification to all admins
- [x] Audit logging on all order/reservation/review/contact mutations

### Redis Strategy
- [x] `notifications:unread:{userId}` — TTL 300s
- [x] `jobs:stats` — TTL 300s
- [x] Exact-key invalidation only, no wildcards

### Hardening (Pre-Phase 13)
- [x] Scheduler singleton guard prevents double-registration
- [x] `processJob` uses atomic `updateMany` to claim jobs (race-condition safe)
- [x] `processJob` caps retries at 10, resets to PENDING for retry instead of immediate FAILED
- [x] WebSocket connection limit (200 max clients)
- [x] Redis `reviews:*` wildcard replaced with exact-key invalidation
- [x] Missing indexes added: `Notification.createdAt`, `StockMovement.createdAt`, `JobQueue.processedAt`

### Tests
- [x] `tests/notification.test.ts` — 10/10 passing
- [x] `tests/audit.test.ts` — 7/7 passing
- [x] `tests/jobs.test.ts` — 11/11 passing
- [x] **Full suite: 178+ passing, 19+ suites**

### Legend
- ✅ Complete
- 🔄 In Progress
- ⏳ Pending
- ❌ Blocked

### Workflow
1. User provides phase plan
2. An **implementation plan** is created at `docs/plans/phase-N.md` for review
3. Implementation begins after user approval
4. A **completion report** is created at `docs/completions/phase-N.md`
