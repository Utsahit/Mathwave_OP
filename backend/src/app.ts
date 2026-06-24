import express from 'express';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from '../docs/openapi.json';
import {
  secureHeaders,
  corsConfiguration,
  rateLimiter,
  jsonBodyParser,
  urlencodedBodyParser,
  nonceMiddleware,
  permissionsPolicy,
  swaggerCspOverride,
} from './middleware/security';
import requestLogger from './middleware/request-logger';
import errorHandler from './middleware/error';
import path from 'path';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import menuRouter from './routes/menu';
import reservationRouter from './routes/reservations';
import reviewRouter from './routes/reviews';
import contactRouter from './routes/contact';
import cartRouter from './routes/cart';
import ordersRouter from './routes/orders';
import paymentsRouter from './routes/payments';
import inventoryRouter from './routes/inventory';
import suppliersRouter from './routes/suppliers';
import purchaseOrdersRouter from './routes/purchase-orders';
import kitchenRouter from './routes/kitchen';
import analyticsRouter from './routes/analytics';
import notificationsRouter from './routes/notifications';
import auditRouter from './routes/audit';
import jobsRouter from './routes/jobs';
import loyaltyRouter from './routes/loyalty';
import couponRouter from './routes/coupons';
import giftcardRouter from './routes/giftcards';
import referralRouter from './routes/referrals';
import branchRouter from './routes/branches';
import franchiseRouter from './routes/franchises';
import transferRouter from './routes/transfers';
import analyticsExecutiveRouter from './routes/analytics-executive';
import reportsRouter from './routes/reports';
import favoritesRouter from './routes/favorites';
import addressesRouter from './routes/addresses';
import supportRouter from './routes/support';
import pushNotificationsRouter from './routes/push-notifications';
import recommendationsRouter from './routes/recommendations';
import mobileRouter from './routes/mobile';
import campaignsRouter from './routes/campaigns';
import segmentsRouter from './routes/segments';
import marketingRouter from './routes/marketing';
import securityRouter from './routes/security';
import dataPrivacyRouter from './routes/data-privacy';
import { branchContext } from './middleware/branch-context';

// Initialize the Express framework instance
const app = express();

// Trust reverse proxy layers (Nginx / Load Balancer) to extract correct client IP headers
app.set('trust proxy', 1);

// Apply performance compression for JSON response payloads
app.use(compression());

// Generate CSP nonce (must be before secureHeaders)
app.use(nonceMiddleware);

// Apply HTTP security headers (Helmet)
app.use(secureHeaders);

// Apply Permissions-Policy header (not included in helmet v7)
app.use(permissionsPolicy);

// Apply Cross-Origin Resource Sharing rules
app.use(corsConfiguration);

// Apply rate limiting protection
app.use(rateLimiter);

// Bind JSON and URL-encoded parsers with explicit memory payload size limits
app.use(jsonBodyParser);
app.use(urlencodedBodyParser);

// Register request metrics and duration logs
app.use(requestLogger);

// Serve static uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Mount core foundational routes (Liveness, Readiness, Version probes)
app.use('/api/v1', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/menu', menuRouter);
app.use('/api/v1', reservationRouter);
app.use('/api/v1', reviewRouter);
app.use('/api/v1', contactRouter);
app.use('/api/v1/cart', cartRouter);
app.use('/api/v1/orders', ordersRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/suppliers', suppliersRouter);
app.use('/api/v1/purchase-orders', purchaseOrdersRouter);
app.use('/api/v1/kitchen', kitchenRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/admin/audit', auditRouter);
app.use('/api/v1/admin/jobs', jobsRouter);

// Phase 13B — Loyalty, Coupons, Gift Cards, Referrals
app.use('/api/v1/loyalty', loyaltyRouter);
app.use('/api/v1/coupons', couponRouter);
app.use('/api/v1/admin/giftcards', giftcardRouter);
app.use('/api/v1/referrals', referralRouter);

// Phase 14 — Multi-Location, Franchise, Branches
app.use('/api/v1/branches', branchContext, branchRouter);
app.use('/api/v1/franchises', franchiseRouter);
app.use('/api/v1/transfers', transferRouter);

// Phase 15 — Executive BI, Forecasting & Advanced Reporting
app.use('/api/v1/analytics/executive', analyticsExecutiveRouter);
app.use('/api/v1/admin/reports', reportsRouter);

// Phase 16 — Mobile App API, Customer Self-Service & Omnichannel
app.use('/api/v1/favorites', favoritesRouter);
app.use('/api/v1/addresses', addressesRouter);
app.use('/api/v1/support', supportRouter);
app.use('/api/v1/push-notifications', pushNotificationsRouter);
app.use('/api/v1/recommendations', recommendationsRouter);
app.use('/api/v1/mobile', mobileRouter);

// Phase 17 — Marketing Automation, CRM & Customer Engagement
app.use('/api/v1/campaigns', campaignsRouter);
app.use('/api/v1/segments', segmentsRouter);
app.use('/api/v1/marketing', marketingRouter);

// Phase 18 — Security, Compliance & Data Privacy
app.use('/api/v1/admin/security', securityRouter);
app.use('/api/v1/data-privacy', dataPrivacyRouter);

// Register Swagger UI documentation (with relaxed CSP for inline scripts/styles)
app.use(
  '/api-docs',
  swaggerCspOverride,
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Elixir & Oak API',
  })
);

// Register global exception filter middleware (Must be declared last)
app.use(errorHandler);

export default app;
