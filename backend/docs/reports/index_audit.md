# Index Audit Report

> **Date:** 2026-06-24 | **Result:** PASS (3 indexes added)

## Methodology

For each model, compared `@@index` declarations against all `WHERE`, `ORDER BY`, `JOIN`, and `GROUP BY` clauses in the service layer.

## Existing Index Coverage

| Model | Indexes | Covering Queries |
|---|---|---|
| User | `email`, `createdAt` | Login, user list |
| Reservation | `date+status`, `date+timeSlot`, `customerId+status`, `reservationCode`, `tableId`, `email`, `status`, `createdAt` | All reservation queries |
| MenuItem | `categoryId+isActive`, `isDeleted`, `isFeatured+isActive+isDeleted`, `name`, `price`, `createdAt` | Menu listing, search, featured |
| Order | `status`, `createdAt`, `userId`, `status+createdAt` | Order listing, filtering, analytics |
| OrderItem | `orderId` | Order detail |
| Transaction | `status`, `razorpayOrderId`, `orderId+status` | Payment verification |
| KitchenTicket | `stationId`, `priority`, `completedAt`, `createdAt` | KDS queries |
| Review | `isApproved`, `isFeatured+isApproved`, `rating`, `createdAt`, `userId`, `email` | Public listing, admin |
| Notification | `userId`, `type`, `isRead`, `isSent` | User notification list |
| AuditLog | `entityType+entityId`, `userId`, `createdAt` | Audit trail |
| JobQueue | `status`, `type`, `createdAt` | Job processing, listing |
| StockMovement | `ingredientId`, `type` | Movement listing |
| Cart | `userId`, `sessionId` | Cart lookup |
| CartItem | `cartId` | Cart detail |
| Ingredient | `name`, `isActive`, `isDeleted`, `currentStock`, `minimumStock` | Stock queries |

## Missing Indexes Found & Fixed

| Model | New Index | Justification |
|---|---|---|
| `Notification` | `@@index([createdAt])` | `orderBy: { createdAt: 'desc' }` in `listNotifications()` at `notification.service.ts:76` |
| `StockMovement` | `@@index([createdAt])` | `orderBy: { createdAt: 'desc' }` in `listStockMovements()` at `stock.service.ts:372` |
| `JobQueue` | `@@index([processedAt])` | Used in cleanup queries and analytics; future-proofing for TTL-based job purging |

## Recommendations (Deferred)

1. **Composite index on Order `(status, createdAt, finalAmount)`** — would accelerate the three analytics aggregation queries that filter by status range and sort by time. Current separate indexes work but require bitmap scans.
2. **Partial index on Notification `(userId) WHERE isRead = false`** — would accelerate unread count queries. Current full-table scan is acceptable at <100K rows.
3. **BRIN indexes** on time-series columns (`createdAt` on AuditLog, Notification, StockMovement) for very large tables (>1M rows).
