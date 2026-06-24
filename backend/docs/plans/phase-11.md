# Phase 11 Implementation Plan
## Kitchen Display System (KDS), Order Fulfillment & Real-Time Tracking

**Status:** ✅ Approved — Implementation in progress  
**Target Tests:** 150+ (22 new tests, 129 existing)  
**Estimated New Files:** ~15  
**Estimated Modified Files:** ~8  

---

## 1. Pre-Implementation Analysis

### Existing Integrations

| Item | Status | Notes |
|---|---|---|
| `socket.io` | ✅ Already in `package.json` v4.7.5 | No setup code exists yet |
| `server.ts` | ✅ HTTP server created | Needs Socket.IO attachment + CORS config |
| JWT auth middleware | ✅ `verifyAccessToken()` in `src/utils/jwt.ts` | Reusable for socket auth |
| Order status transitions | ✅ `VALID_TRANSITIONS` in `order.service.ts` | KDS fulfillment hooks into PENDING→CONFIRMED→PREPARING→READY |
| Stock consumption | ✅ Triggered in `order.repository.ts:201` on CONFIRMED | Must ensure KDS ticket creation emits AFTER stock consumption |
| Permission seeding | ✅ Established pattern in `prisma/seed.ts` | Follow same `upsert` pattern |
| Analytics cache | ✅ `order:stats` key exists | New `analytics:dashboard` key must play alongside it |

### Potential Risks

| Risk | Mitigation |
|---|---|
| Socket.IO CORS for frontend | Use same CORS config as Express |
| Socket auth must verify session still exists | Reuse `verifyAccessToken` + `prisma.userSession.findUnique` |
| Ticket auto-creation after stock consumption may fail | Run inside same transaction as order status update |
| Test suite needs Socket.IO client | Use `socket.io-client` in devDependencies |
| Analytics `groupBy` with Decimal types | Cast to float in raw SQL or use Prisma's `_sum` |

---

## 2. Database Changes

### Migration Order (single migration)

1. Create `TicketPriority` enum
2. Create `KitchenStation` model
3. Create `KitchenTicket` model
4. Add indexes

### Schema

```prisma
enum TicketPriority {
  LOW
  NORMAL
  HIGH
  URGENT
}

model KitchenStation {
  id          String   @id @default(uuid())
  name        String
  description String?
  isActive    Boolean  @default(true)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([isActive])
}

model KitchenTicket {
  id              String         @id @default(uuid())
  orderId         String         @unique
  stationId       String?
  station         KitchenStation? @relation(fields: [stationId], references: [id])
  priority        TicketPriority @default(NORMAL)
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  order           Order          @relation(fields: [orderId], references: [id])

  @@index([stationId])
  @@index([priority])
  @@index([completedAt])
  @@index([createdAt])
}
```

### Important Design Decisions

- **`orderId` is `@unique`**: One ticket per order. This prevents duplicate ticketing.
- **`station` relation added**: The plan mentions `stationId` but no relation. Adding relation keeps referential integrity.
- **`@@index([completedAt])`**: Needed for filtering active vs completed tickets efficiently.

---

## 3. Implementation Order

Files must be created in this order to respect dependencies:

```
Step  1: Schema + Migration + Generate
Step  2: Permission seeding (seed.ts)
Step  3: realtime.service.ts          (no deps on other new services)
Step  4: kitchen.service.ts           (depends on realtime.service.ts)
Step  5: fulfillment.service.ts       (depends on kitchen, realtime)
Step  6: kitchen.controller.ts
Step  7: analytics.controller.ts      (depends on existing services only)
Step  8: kitchen routes
Step  9: analytics routes
Step 10: Socket.IO setup in server.ts
Step 11: Wire fulfillment into order.service.ts
Step 12: Tests (kitchen → analytics → realtime)
Step 13: Seed data for KitchenStation
Step 14: Verify + final test run
```

---

## 4. File-by-File Breakdown

### 4a. `src/services/realtime.service.ts` (NEW)

**Purpose:** Singleton managing Socket.IO server instance, namespace subscription, and event broadcasting.

```typescript
export class RealtimeService {
  private io: Server;
  private kitchenNamespace: Namespace;
  private orderNamespace: Namespace;

  initialize(httpServer: http.Server): void
  // Create Socket.IO server, attach namespaces, register auth middleware
  // Auth: verify JWT access token, check session exists, reject if invalid

  broadcastToKitchen(event: string, data: any): void
  // Emit to /kitchen namespace

  broadcastToOrder(orderId: string, event: string, data: any): void
  // Emit to a specific room within /orders namespace (room = orderId)

  emitToUser(userId: string, event: string, data: any): void
  // Emit to a specific user room within /orders namespace
}
```

**Auth Middleware for Socket.IO:**
```typescript
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  // Verify JWT
  // Check userSession exists
  // Attach user to socket.data
  // Enforce RBAC for namespace access
});
```

**Events emitted:**
| Event | Namespace | Trigger |
|---|---|---|
| `ORDER_CREATED` | /orders | Order created |
| `ORDER_CONFIRMED` | /orders | Order confirmed (+stock consumed) |
| `ORDER_PREPARING` | /orders + /kitchen | Ticket started |
| `ORDER_READY` | /orders + /kitchen | Ticket completed |
| `ORDER_OUT_FOR_DELIVERY` | /orders | Status transition |
| `ORDER_DELIVERED` | /orders | Status transition |
| `TICKET_ASSIGNED` | /kitchen | Station assigned |
| `TICKET_STARTED` | /kitchen | Prep started |
| `TICKET_COMPLETED` | /kitchen | Prep completed |

### 4b. `src/services/kitchen.service.ts` (NEW)

**Purpose:** Kitchen ticket lifecycle management.

```typescript
export class KitchenService {
  async createTicket(orderId: string, priority?: TicketPriority): Promise<KitchenTicket>
  // Called automatically when order status → CONFIRMED
  // Guards against duplicate tickets: checks findExistingTicket(orderId) before create
  // Also emits ORDER_CONFIRMED event via realtime service

  async findExistingTicket(orderId: string): Promise<KitchenTicket | null>
  // Prevents duplicate ticket creation on retries or race conditions

  async assignStation(ticketId: string, stationId: string, changedBy: string): Promise<KitchenTicket>
  // Validates station exists and is active
  // Emits TICKET_ASSIGNED

  async startPreparation(ticketId: string): Promise<KitchenTicket>
  // Sets startedAt = now()
  // Transitions order status to PREPARING via fulfillment service
  // Emits TICKET_STARTED + ORDER_PREPARING

  async completePreparation(ticketId: string): Promise<KitchenTicket>
  // Sets completedAt = now()
  // Transitions order status to READY via fulfillment service
  // Emits TICKET_COMPLETED + ORDER_READY

  async updatePriority(ticketId: string, priority: TicketPriority, changedBy: string): Promise<KitchenTicket>
  // Validates transition, creates audit entry

  async getTicket(id: string): Promise<KitchenTicket>
  async listTickets(filters: { stationId?, status?, priority?, page, limit }): Promise<{ items, total }>
  // "status" filter: 'active' = startedAt NOT NULL AND completedAt IS NULL
  //                'pending' = startedAt IS NULL
  //                'completed' = completedAt IS NOT NULL
}
```

**Business Rule — Auto-create ticket on CONFIRMED:**
- Location: In `fulfillment.service.ts` which is called after stock consumption succeeds
- Must call `findExistingTicket(orderId)` before creating — the `@unique` constraint is the last safeguard, not the first

**WebSocket Resilience — Emit Failures Must Not Affect Orders:**
```typescript
await createTicket();
try {
  realtimeService.broadcastToKitchen('TICKET_CREATED', ticket);
} catch (err) {
  logger.warn('Socket.IO emit failed — order processing continues', err);
}
```
Order processing MUST continue even if Socket.IO emit fails. Log the warning and move on.

### 4c. `src/services/fulfillment.service.ts` (NEW)

**Purpose:** Orchestrates order workflow by coordinating kitchen service, realtime service, and the existing order repository.

```typescript
export class FulfillmentService {
  async confirmOrder(orderId: string, changedBy: string): Promise<Order>
  // 1. Call orderRepository.updateOrderStatus(PENDING → CONFIRMED)
  //    — This internally consumes stock
  // 2. Call kitchenService.createTicket(orderId)
  // 3. Broadcast ORDER_CONFIRMED via realtime

  async startPreparing(orderId: string, ticketId: string, changedBy: string): Promise<Order>
  async markReady(orderId: string, ticketId: string, changedBy: string): Promise<Order>
  async markOutForDelivery(orderId: string, changedBy: string): Promise<Order>
  async markDelivered(orderId: string, changedBy: string): Promise<Order>
  async cancelOrder(orderId: string, changedBy: string): Promise<Order>
}
```

**Design Decision:** Rather than modifying `order.service.ts` heavily, `fulfillment.service.ts` wraps the existing `orderRepository.updateOrderStatus` and adds the kitchen + realtime orchestration. The existing `orderService.updateOrderStatus` can remain as a lower-level API for internal use, while `fulfillmentService` becomes the primary API for status transitions.

### 4d. `src/controllers/kitchen.controller.ts` (NEW)

| Endpoint | Method | Permission | Description |
|---|---|---|---|
| `GET /api/v1/kitchen/tickets` | listTickets | kitchen:view | Paginated, filterable |
| `GET /api/v1/kitchen/tickets/:id` | getTicket | kitchen:view | Single ticket |
| `PUT /api/v1/kitchen/tickets/:id/start` | startTicket | kitchen:update | Start prep |
| `PUT /api/v1/kitchen/tickets/:id/complete` | completeTicket | kitchen:update | Complete prep |
| `PUT /api/v1/kitchen/tickets/:id/priority` | updatePriority | kitchen:update | Change priority |
| `PUT /api/v1/kitchen/tickets/:id/assign` | assignStation | kitchen:assign | Assign to station |

### 4e. `src/controllers/analytics.controller.ts` (NEW)

| Endpoint | Method | Permission | Description |
|---|---|---|---|
| `GET /api/v1/analytics/dashboard` | getDashboard | analytics:view | Aggregated KPIs |
| `GET /api/v1/analytics/orders` | getOrderAnalytics | analytics:view | Order metrics |
| `GET /api/v1/analytics/revenue` | getRevenueAnalytics | analytics:view | Revenue metrics |
| `GET /api/v1/analytics/inventory` | getInventoryAnalytics | analytics:view | Inventory metrics |

### 4f. Analytics Service (`src/services/analytics.service.ts`) (NEW)

**Purpose:** Aggregate-only queries using Prisma `aggregate()` and `groupBy()`.

**Dashboard metrics:**
```typescript
async getDashboard(): Promise<{
  totalOrders: number;
  ordersToday: number;
  revenueToday: number;
  revenueThisMonth: number;
  averageOrderValue: number;
  topSellingItems: { menuItemId: string; name: string; totalSold: number }[];
  lowStockCount: number;
  pendingReservations: number;
  activeKitchenTickets: number;
}>
```

**Implementation notes:**
- `revenueToday` / `revenueThisMonth`: aggregate `finalAmount` where status ≥ CONFIRMED
- `averageOrderValue`: `_avg.finalAmount` on completed orders
- `topSellingItems`: `groupBy` on `OrderItem` with `_sum.quantity`, join to `MenuItem` for names, `take: 10` to prevent unbounded growth
- `lowStockCount`: Reuse raw SQL from `stock.service.ts` (or extract to shared method)
- `pendingReservations`: `count` where status = PENDING
- `activeKitchenTickets`: `count` where startedAt IS NOT NULL AND completedAt IS NULL
- Cache under `analytics:dashboard` with 300s TTL
- Invalidate on order update, payment success, inventory change, reservation change

### 4g. Routes

**`src/routes/kitchen.ts`** (NEW)
```
GET    /api/v1/kitchen/tickets          → kitchen:view
GET    /api/v1/kitchen/tickets/:id      → kitchen:view
PUT    /api/v1/kitchen/tickets/:id/start → kitchen:update
PUT    /api/v1/kitchen/tickets/:id/complete → kitchen:update
PUT    /api/v1/kitchen/tickets/:id/priority → kitchen:update
PUT    /api/v1/kitchen/tickets/:id/assign → kitchen:assign
```

**`src/routes/analytics.ts`** (NEW)
```
GET    /api/v1/analytics/dashboard   → analytics:view
GET    /api/v1/analytics/orders      → analytics:view
GET    /api/v1/analytics/revenue     → analytics:view
GET    /api/v1/analytics/inventory   → analytics:view
```

### 4h. Validation (`src/validators/kitchen.validator.ts`) (NEW)

Zod schemas for:
- `updateTicketPrioritySchema` — `priority` enum
- `assignStationSchema` — `stationId` uuid
- No body validation needed for start/complete (no body params)

### 4i. Integration Wiring

**Modify `src/server.ts`:**
```typescript
import { realtimeService } from './services/realtime.service';

async function bootstrap() {
  // ... existing setup ...
  httpServer = app.listen(env.PORT, () => { ... });
  realtimeService.initialize(httpServer);
}
```

**Modify `src/services/order.service.ts` — `updateOrderStatus`:**
- Keep existing validation and repository call
- After successful update, broadcast event via `realtimeService.broadcastToOrder()`
- Clear `analytics:dashboard` cache in addition to `order:stats`

**Alternative (cleaner):** Only `fulfillment.service.ts` broadcasts events. The existing `orderService.updateOrderStatus` remains a low-level transition. External callers (controllers) route through `fulfillmentService` for status transitions that need real-time.

### 4j. Seed Data Update

**Permission additions in `prisma/seed.ts`:**
```typescript
{ name: 'kitchen:view', description: 'Can view kitchen tickets.' },
{ name: 'kitchen:update', description: 'Can update kitchen ticket status.' },
{ name: 'kitchen:assign', description: 'Can assign tickets to stations.' },
{ name: 'analytics:view', description: 'Can view dashboard analytics.' },
```

**Role mappings:**
- ADMIN: all 4
- MANAGER: all 4
- STAFF: `kitchen:view`, `kitchen:update`
- CUSTOMER: none

**KitchenStation seed data:**
```typescript
{ name: 'Main Line', description: 'Main cooking station for all orders' },
{ name: 'Grill', description: 'Grill and charbroil items' },
{ name: 'Salad', description: 'Cold prep and salads' },
{ name: 'Dessert', description: 'Desserts and pastry station' },
{ name: 'Beverage', description: 'Drinks and beverages' },
```

---

## 5. Test Plan

### 5a. `tests/kitchen.test.ts` — ~8 tests

| # | Test | Expected |
|---|---|---|
| 1 | Create ticket via order CONFIRMED | 201, ticket created |
| 2 | Assign ticket to station | 200, stationId set |
| 3 | Start preparation | 200, status=PREPARING, startedAt set |
| 4 | Complete preparation | 200, status=READY, completedAt set |
| 5 | List tickets with filters | 200, paginated |
| 6 | Get single ticket | 200, correct data |
| 7 | Update priority | 200, priority changed |
| 8 | RBAC: STAFF cannot assign | 403 |

### 5b. `tests/analytics.test.ts` — ~6 tests

| # | Test | Expected |
|---|---|---|
| 1 | Get dashboard data | 200, all fields present |
| 2 | Dashboard cached (second call fast) | 200, cached response |
| 3 | Order analytics | 200, aggregate data |
| 4 | Revenue analytics | 200, revenue fields |
| 5 | Inventory analytics | 200, low stock count |
| 6 | RBAC: CUSTOMER cannot access | 403 |

### 5c. `tests/realtime.test.ts` — ~8 tests

| # | Test | Expected |
|---|---|---|
| 1 | Socket authentication with valid token | Connection accepted |
| 2 | Socket authentication with invalid token | Connection rejected |
| 3 | Socket authentication with expired token | Connection rejected |
| 4 | Subscribe to kitchen namespace | Events received |
| 5 | Kitchen events broadcast on ticket actions | TICKET_STARTED, TICKET_COMPLETED received |
| 6 | Order events broadcast on status change | ORDER_PREPARING, ORDER_READY received |
| 7 | Room isolation (order-specific) | Only subscribers in room receive event |
| 8 | Unauthorized namespace access rejected | 401 on connection |

### Total Test Count

| Suite | Existing | New | Total |
|---|---|---|---|
| Existing (13 suites) | 129 | — | 129 |
| kitchen.test.ts | — | 8 | 8 |
| analytics.test.ts | — | 6 | 6 |
| realtime.test.ts | — | 8 | 8 |
| **Grand Total** | **129** | **22** | **151** |

---

## 6. Caching Strategy

### New Redis Keys

| Key | TTL | Invalidation |
|---|---|---|
| `analytics:dashboard` | 300s | `del()` on: order status update, payment success, inventory mutation, reservation change |
| `analytics:orders` | 300s | `del()` on: order status update, payment success |
| `analytics:revenue` | 300s | `del()` on: payment success |
| `analytics:inventory` | 300s | `del()` on: inventory mutation, stock consumption |

### Invalidation Points

Add relevant `del(` calls alongside existing `del('order:stats')` in:
- `order.repository.ts` — after status update: `del('analytics:dashboard')`, `del('analytics:orders')`
- `payment.service.ts` — after payment verification: `del('analytics:dashboard')`, `del('analytics:orders')`, `del('analytics:revenue')`
- `stock.service.ts` — in `clearCache()`: `del('analytics:dashboard')`, `del('analytics:inventory')`
- `reservation.service.ts` — after reservation create/update/delete: `del('analytics:dashboard')`

---

## 7. Performance Checklist

- [x] No N+1 queries — all Prisma `include`/`select` are explicit
- [x] Prisma `select()` on every query
- [x] No `SELECT *`
- [x] Pagination on all list endpoints
- [x] Dashboard cached with 300s TTL
- [x] Socket broadcasts are non-blocking (`emit()` not `emit().to().to()` chains)
- [x] No endpoint > 500ms under normal load
- [x] Exact-key cache invalidation only (no `keys *` / wildcard)
- [x] `Promise.all()` where safe (parallel stats queries in dashboard)
- [x] All new indexes created for filter/sort fields

---

## 8. Open Questions

1. **Should `fulfillment.service.ts` replace `orderService.updateOrderStatus` entirely, or coexist?**  
   *Recommendation: Coexist. Controllers that need real-time go through `fulfillmentService`. Internal/legacy calls can use `orderService` directly.*

2. **Where should the analytics cache invalidation live?**  
   *Resolved: Inline `del()` calls at each mutation point. Each key (`analytics:dashboard`, `analytics:orders`, `analytics:revenue`, `analytics:inventory`) is invalidated independently to minimize unnecessary cache clears.*

3. **Should `topSellingItems` in the dashboard be time-bound (e.g., last 30 days)?**  
   *Recommendation: Yes — default to last 30 days for meaningful data.*

4. **Should the `ORDER_CREATED` event be emitted from `order.service.ts` directly, or from the controller after order creation?**  
   *Recommendation: From the service (`orderRepository.createOrder` returns the order). Emit after successful creation.*

---

## 9. Verification Steps

```bash
# 1. Generate migration
npx prisma migrate dev --name add_kds_and_analytics

# 2. Generate client
npx prisma generate

# 3. Seed new permissions + stations
npx prisma db seed

# 4. Build
npm run build

# 5. Lint
npm run lint

# 6. Test
npm test

# Expected output:
# PASS tests/kitchen.test.ts (8 tests)
# PASS tests/analytics.test.ts (6 tests)
# PASS tests/realtime.test.ts (8 tests)
# ... (13 existing suites)
# Test Suites: 16 passed, 16 total
# Tests:       151 passed, 151 total
```

---

## 10. Rollback Plan

If Phase 11 needs to be rolled back:

```bash
# Revert migration (reset wipes DB — use only in dev)
npx prisma migrate reset

# Alternatively, resolve a failed migration without data loss:
npx prisma migrate resolve --rolled-back <migration-name>

# Revert seed changes
# Manually remove kitchen:* and analytics:* permissions from DB
# Delete KitchenStation seed data

# Revert code changes
git revert HEAD --no-commit  # if committed
# OR manually delete new files and revert modifications
```

---

## Approval

**Review and approve this plan to begin implementation.**
