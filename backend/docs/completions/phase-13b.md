# Phase 13B Completion Report — Loyalty, Coupons, Rewards & Gift Cards

> **Completed:** 2026-06-23  
> **Test Count:** 207 passing (23 suites, +29 new tests)  
> **Plan Reference:** [docs/plans/phase-13b.md](../plans/phase-13b.md)

## Summary

Implemented a full loyalty program with points earning/redeeming, coupon management (CRUD + validation + application), gift card processing with double-spend protection, and a referral reward system. All financial operations use transactional safety and Redis caching.

## What Was Built

### Schema Changes
- **New enums**: `LoyaltyTransactionType` (EARNED, REDEEMED, EXPIRED, ADJUSTMENT, REFERRAL_BONUS), `CouponType` (PERCENTAGE, FIXED)
- **New models**: `LoyaltyTransaction`, `Coupon`, `CouponRedemption`, `GiftCard`, `GiftCardRedemption`, `Referral`
- **New field on User**: `loyaltyPoints` (Int, default 0)
- **New fields on Order**: `subtotalAmount`, `couponDiscount`, `loyaltyDiscount`, `giftCardDiscount` (all Decimal), `couponId` (optional FK)
- **New NotificationType values**: `LOYALTY_POINTS_EARNED`, `LOYALTY_POINTS_REDEEMED`, `COUPON_APPLIED`, `GIFT_CARD_USED`, `REFERRAL_REWARD`

### Permission Seeding
- 10 new permissions: `loyalty:view`, `loyalty:update`, `coupon:view`, `coupon:create`, `coupon:update`, `coupon:delete`, `giftcard:view`, `giftcard:create`, `giftcard:update`, `giftcard:delete`
- ADMIN: all 10; MANAGER: loyalty:view, coupon:view/create/update, giftcard:view; STAFF: loyalty:view; CUSTOMER: none

### Repositories (4 new)
| Repository | Key methods |
|---|---|
| `loyalty.repository.ts` | findByUserId, createTransaction, getBalance, getHistory, getTotalEarned |
| `coupon.repository.ts` | findByCode, listCoupons, updateCoupon, incrementUsage |
| `giftcard.repository.ts` | findByCode, findById, createGiftCard, listGiftCards, updateGiftCard |
| `referral.repository.ts` | findByUserId, findByReferredUserId, createReferral, getReferralCount |

### Services (4 new)
- **`loyalty.service.ts`** — Earn points (10 per ₹100), redeem points (100 pts = ₹10), referral bonus (100/50 split), expiry, admin adjustment. Atomic `$transaction` for all mutations. Redis cache on balance (TTL 300s).
- **`coupon.service.ts`** — Full CRUD, `validateCoupon` (active, dates, usage limit, min order), `calculateDiscount` (percentage clamped to maxDiscount, fixed), `applyCoupon` (increments usedCount atomically). Redis cache.
- **`giftcard.service.ts`** — CRUD + `redeemGiftCard` with double-spend protection via `$transaction` (re-read fresh balance, check sufficiency, decrement, create redemption record). Redis cache invalidated on mutation.
- **`referral.service.ts`** — Create referral link, grant bonus points (atomic, one per unique pair).

### Discount Waterfall (Order Service)
`createOrderFromCart` now accepts optional `discounts` object:
1. Validate coupon (if `couponCode` provided) → `couponDiscount`
2. Redeem loyalty points (if `loyaltyPoints` provided) → `loyaltyDiscount`
3. Validate gift card (if `giftCardCode` provided) → `giftCardDiscount`
4. Compute: `subtotal - coupon - loyalty`, then `final = subtotal - coupon - loyalty - giftCard + tax`
5. After order creation: record gift card redemption and coupon usage atomically

### Routes (4 new)
| Router | Endpoints | RBAC |
|--------|-----------|------|
| `/api/v1/loyalty` | GET /balance, GET /history, POST /redeem, POST /adjust | loyalty:view, loyalty:update |
| `/api/v1/coupons` | GET /, POST /, PUT /:id, DELETE /:id, POST /validate, POST /apply | coupon:view/create/update/delete |
| `/api/v1/admin/giftcards` | GET /, POST /, PATCH /:id, PATCH /:id/deactivate, POST /redeem | giftcard:view/create/update/delete |
| `/api/v1/referrals` | GET /, POST /, POST /:id/grant-bonus | loyalty:view, loyalty:update |

### Redis Strategy
- Keys: `loyalty:balance:{userId}`, `coupon:{code}`, `giftcard:{code}`, `analytics:loyalty`
- TTL: 300s
- Invalidation: Exact-key DEL on mutation (no wildcards)

### Analytics Integration
- `analytics.service.ts` extended with `getLoyaltyAnalytics()`:
  - `totalMembers`, `pointsIssued`, `pointsRedeemed`
  - `totalCoupons`, `couponRedemptionRate`
  - `giftCardUtilization`
  - `referralConversionRate`
- Route: `GET /api/v1/analytics/loyalty`
- Cache: independent key `analytics:loyalty` at TTL 300s

## Performance Compliance
- All Prisma queries use explicit `select()` — no N+1
- Pagination on all list endpoints
- Redis exact-key DEL only (no KEYS/wildcard)
- `$transaction` for atomic financial operations
- Parallel `Promise.all` where appropriate

## Defects Fixed During QA
1. **Query schema preprocess**: `z.preprocess` guarded against `undefined`/`''` before `Number()` in coupon, giftcard, and referral validators
2. **Gift card double-spend**: Removed `Math.min()` silent clamp — now throws `INSUFFICIENT_BALANCE` when amount exceeds remaining balance
3. **Coupon test timing**: `startsAt` set to past instead of future so validation passes immediately
4. **Coupon RBAC test**: Corrected from STAFF→200 (wrong) to STAFF→403 (matches seed permissions)
5. **Gift card redemption FK**: `beforeAll` creates real Order via raw Prisma instead of fake UUID

## Tests Added (30 new)
- **`tests/loyalty.test.ts`** — 9 tests: balance, history (paginated), redeem points, insufficient points, RBAC (CUSTOMER/STAFF view, CUSTOMER redeem), unauthenticated
- **`tests/coupon.test.ts`** — 8 tests: create (ADMIN), reject CUSTOMER create, list, unauthenticated, validate valid, validate non-existent, RBAC (CUSTOMER reject, STAFF reject)
- **`tests/giftcard.test.ts`** — 8 tests: create (ADMIN), reject CUSTOMER create, list, unauthenticated, redeem valid, reject double-spend, deactivate, **concurrent redemption (lost update prevention)**
- **`tests/referral.test.ts`** — 5 tests: list, create, grant bonus, reject double referral, RBAC (CUSTOMER cannot grant)

## Key Decisions
- **Loyalty rate**: ₹100 spent = 10 points; 100 points = ₹10 redemption value
- **Referral rewards**: referrer gets 100 pts, referred gets 50 pts, once per unique pair
- **Gift card redemption**: atomic `UPDATE "GiftCard" SET "remainingAmount" = "remainingAmount" - $1 WHERE "code" = $2 AND "remainingAmount" >= $1` via `$executeRawUnsafe`. This is the *only* safe pattern for concurrent decrement — a read-then-write inside `$transaction` is vulnerable to lost updates under `READ COMMITTED` (PostgreSQL default). The atomic SQL WHERE clause ensures at most one concurrent redemption succeeds per gift card.
- **Coupon discount waterfall**: coupon → loyalty → gift card → subtotal → tax → final
- **`subtotalAmount` default 0** on Order allows migration with existing rows
- **Admin prefix `/api/v1/admin/giftcards`** — gift card management is admin-only by route convention

## Concurrency Audit (Gift Card)

### Findings
1. **Lost update vulnerability identified**: The original read→compute→write pattern inside `$transaction` could produce a negative balance or over-redeem the card under concurrent requests with `READ COMMITTED` isolation (PostgreSQL default, Prisma default).

2. **Fix applied**: Replaced with atomic SQL conditional decrement. The `UPDATE` itself verifies `remainingAmount >= redeemAmount` in the WHERE clause, eliminating the race window entirely. Only one concurrent transaction's UPDATE will match the row — the other affects 0 rows and triggers a diagnostics re-read.

3. **Isolation guarantee**: PostgreSQL's `READ COMMITTED` guarantees each statement sees the latest committed row version, so the WHERE clause evaluates correctly even under concurrent load. No `SERIALIZABLE` isolation or `SELECT FOR UPDATE` required.

4. **Negative balance is impossible**: The `AND "remainingAmount" >= $1` clause in the UPDATE makes it a no-op when balance is insufficient, and the code path after a 0-row update always throws before any write occurs.

### Test
- **Concurrent Redemption Protection** test fires two simultaneous ₹600 redemptions against a ₹1,000 card via `Promise.all`. Asserts at most one succeeds, and `totalRedeemed + remaining === originalAmount` (invariant check directly on DB).

### Schema
```sql
UPDATE "GiftCard"
SET "remainingAmount" = "remainingAmount" - ?
WHERE "code" = ? AND "remainingAmount" >= ? AND "isActive" = true
```
