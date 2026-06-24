# Payment Security Review

## Audit Date
June 2026

## Scope
Audit of Razorpay payment integration:
- Signature verification
- Webhook validation
- Replay protection
- Idempotency
- Order status integrity

## Files Reviewed
- `src/services/payment.service.ts`
- `src/repositories/payment.repository.ts`
- `src/routes/payments.ts`
- `src/controllers/payment.controller.ts`

## Findings

### 1. Razorpay Order Creation (`payment.service.ts:25-96`)

| Check | Status | Details |
|-------|--------|---------|
| Amount validation | ✅ | `finalAmount` converted to paise (Math.round) |
| Double-payment prevention | ✅ | `isOrderAlreadyPaid()` check before creation |
| Transaction record | ✅ | Created before Razorpay API call (for audit trail) |
| Razorpay error handling | ✅ | Transaction marked FAILED, user gets 502 |
| Order ID in notes | ✅ | `orderId` and `transactionId` in Razorpay notes |
| SQL injection | ✅ Fixed | Replaced `$executeRawUnsafe` with Prisma parameterized query |

### 2. Payment Signature Verification (`payment.service.ts:98-159`)

| Check | Status | Details |
|-------|--------|---------|
| Algorithm | ✅ HMAC-SHA256 | Industry standard |
| Data integrity | ✅ | `razorpayOrderId|razorpayPaymentId` format |
| Secret handling | ✅ | Uses `RAZORPAY_KEY_SECRET` from env |
| Timing attack resistant | ✅ | `crypto.createHmac` is constant-time |
| Failure logging | ✅ | `logger.warn` on mismatch |
| Transaction status | ✅ | Marked FAILED on signature mismatch |
| Order status update | ✅ | Advanced to CONFIRMED on success |

### 3. Webhook Processing (`payment.service.ts:163-218`)

| Check | Status | Details |
|-------|--------|---------|
| Signature verification | ✅ HMAC-SHA256 | `RAZORPAY_WEBHOOK_SECRET` used |
| Raw body processing | ✅ | `bodyRaw` verified before parsing |
| Idempotency guard | ✅ | `WebhookEvent` table prevents double-processing |
| Event type filtering | ✅ | Only `order.paid` / `payment.captured` processed |
| Transaction check | ✅ | Verifies status !== PAID before updating |
| Order advancement | ✅ | Status set to CONFIRMED via `orderService` |
| Error logging | ✅ | `logger.info/warn` throughout |
| Unauthenticated endpoint | ⚠️ No auth middleware | Acceptable — uses signature verification |

### 4. Razorpay SDK Security

| Check | Status | Details |
|-------|--------|---------|
| SDK version | ✅ | `razorpay` ^2.9.2 (current) |
| Key usage | ✅ | `key_id` and `key_secret` from environment |
| Instance pattern | ✅ | Lazy getter (supports test mocking) |
| No hardcoded keys | ⚠️ Dev fallbacks | `rzp_test_change_me` placeholders in dev |

### 5. Replay Attack Protection

| Scenario | Protected? | Mechanism |
|----------|:----------:|-----------|
| Same payment signature replayed | ✅ | Transaction marked PAID, second attempt fails (already PAID) |
| Same webhook event replayed | ✅ | `WebhookEvent` table prevents duplicate processing |
| Same order paid twice | ✅ | `isOrderAlreadyPaid()` before Razorpay order creation |
| Old webhook signature reused | ✅ | HMAC-SHA256 verification tied to request body |

### 6. Order Status Integrity

| Check | Status | Details |
|-------|--------|---------|
| Status advancement | ✅ | PAID → CONFIRMED (forward-only) |
| No backward transitions | ✅ | `orderService.updateOrderStatus` validates transitions |
| Audit trail | ✅ | Status changes logged via `auditService` |
| Payment gateway confirmation | ✅ | Order only CONFIRMED after signature or webhook verification |

## Risk Assessment

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 0 | — |
| Low | 1 | Dev Razorpay key fallbacks |

## Recommendations

1. **Rate limit webhook endpoint**: Consider adding IP-based allowlisting for Razorpay webhook IPs
2. **Webhook secret rotation**: Rotate `RAZORPAY_WEBHOOK_SECRET` periodically
3. **Monitor failed verifications**: Add alerting for repeated signature mismatches (potential fraud)
4. **Production keys**: Ensure live Razorpay keys are used in production (not test keys)

## Conclusion

Payment security is robust. Razorpay integration follows all security best practices: HMAC-SHA256 signature verification for both checkout and webhooks, idempotency guards via `WebhookEvent` table, double-payment prevention, proper error handling, and order status integrity. The previously identified `$executeRawUnsafe` SQL injection vector has been fixed with a parameterized Prisma query. No payment manipulation paths were identified.
