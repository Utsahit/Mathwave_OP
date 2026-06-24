import { Router } from 'express';
import { contactController } from '../controllers/contact.controller';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { branchScopeMiddleware } from '../middleware/branch-context';
import { contactLimiter, newsletterLimiter } from '../middleware/rate-limiter';
import {
  createContactSchema,
  createNewsletterSchema,
  unsubscribeSchema,
  contactQuerySchema,
  newsletterQuerySchema,
} from '../validators/contact.validator';

const router = Router();

// ── Public Contact & Newsletter Endpoints ────────────────────────────────────

/**
 * @swagger
 * /api/v1/contact:
 *   post:
 *     summary: Submit a new contact message
 *     tags: [Contact - Public]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, subject, message]
 *             properties:
 *               name:    { type: string, example: "Rahul Verma" }
 *               email:   { type: string, format: email, example: "rahul@example.com" }
 *               subject: { type: string, example: "Catering Enquiry" }
 *               message: { type: string, example: "I would like to inquire about hosting a private event." }
 *     responses:
 *       201:
 *         description: Inquiry submitted successfully
 *       422:
 *         description: Profanity detected in subject or message
 *       429:
 *         description: IP Rate limit or email cooldown triggered
 */
router.post(
  '/contact',
  contactLimiter,
  validate({ body: createContactSchema }),
  contactController.submitContactMessage
);

/**
 * @swagger
 * /api/v1/newsletter:
 *   post:
 *     summary: Subscribe to the newsletter
 *     tags: [Newsletter - Public]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, example: "newsletter@example.com" }
 *     responses:
 *       201:
 *         description: Successfully subscribed
 *       409:
 *         description: Already subscribed
 */
router.post(
  '/newsletter',
  newsletterLimiter,
  validate({ body: createNewsletterSchema }),
  contactController.subscribeNewsletter
);

/**
 * @swagger
 * /api/v1/newsletter/unsubscribe:
 *   post:
 *     summary: Unsubscribe from the newsletter
 *     tags: [Newsletter - Public]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, example: "newsletter@example.com" }
 *     responses:
 *       200:
 *         description: Successfully unsubscribed
 *       400:
 *         description: Email is not subscribed
 */
router.post(
  '/newsletter/unsubscribe',
  newsletterLimiter,
  validate({ body: unsubscribeSchema }),
  contactController.unsubscribeNewsletter
);

// ── Admin Contact & Newsletter Endpoints ─────────────────────────────────────

/**
 * @swagger
 * /api/v1/admin/contact/stats:
 *   get:
 *     summary: Get unread, total, and today's message statistics
 *     tags: [Contact - Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get(
  '/admin/contact/stats',
  requireAuth(),
  requirePermission('contact:view'),
  contactController.getContactStats
);

/**
 * @swagger
 * /api/v1/admin/contact:
 *   get:
 *     summary: List customer contact inquiries with filters
 *     tags: [Contact - Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isRead
 *         schema: { type: boolean }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, email] }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated message inquiries list
 */
router.get(
  '/admin/contact',
  requireAuth(),
  requirePermission('contact:view'),
  branchScopeMiddleware,
  validate({ query: contactQuerySchema }),
  contactController.adminListMessages
);

/**
 * @swagger
 * /api/v1/admin/contact/{id}:
 *   get:
 *     summary: Get single contact inquiry detail by ID
 *     tags: [Contact - Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Message detail record
 *       404:
 *         description: Message not found
 */
router.get(
  '/admin/contact/:id',
  requireAuth(),
  requirePermission('contact:view'),
  contactController.getContactMessage
);

/**
 * @swagger
 * /api/v1/admin/contact/{id}/read:
 *   put:
 *     summary: Mark a contact inquiry read or unread
 *     tags: [Contact - Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isRead]
 *             properties:
 *               isRead: { type: boolean, example: true }
 *     responses:
 *       200:
 *         description: Message read status updated successfully
 */
router.put(
  '/admin/contact/:id/read',
  requireAuth(),
  requirePermission('contact:update'),
  contactController.markRead
);

/**
 * @swagger
 * /api/v1/admin/contact/{id}:
 *   delete:
 *     summary: Soft delete a contact message
 *     tags: [Contact - Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Message deleted successfully
 */
router.delete(
  '/admin/contact/:id',
  requireAuth(),
  requirePermission('contact:delete'),
  contactController.softDeleteMessage
);

/**
 * @swagger
 * /api/v1/admin/newsletter/stats:
 *   get:
 *     summary: Get active, inactive, and today's subscription statistics
 *     tags: [Newsletter - Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get(
  '/admin/newsletter/stats',
  requireAuth(),
  requirePermission('contact:view'),
  contactController.getNewsletterStats
);

/**
 * @swagger
 * /api/v1/admin/newsletter:
 *   get:
 *     summary: List all newsletter subscribers with filters
 *     tags: [Newsletter - Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated subscribers list
 */
router.get(
  '/admin/newsletter',
  requireAuth(),
  requirePermission('contact:view'),
  validate({ query: newsletterQuerySchema }),
  contactController.adminListSubscribers
);

/**
 * @swagger
 * /api/v1/admin/newsletter/export:
 *   get:
 *     summary: Export all subscribers (JSON or CSV format)
 *     tags: [Newsletter - Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, csv], default: json }
 *     responses:
 *       200:
 *         description: Subscribers list or CSV download attachment
 */
router.get(
  '/admin/newsletter/export',
  requireAuth(),
  requirePermission('contact:view'),
  contactController.exportSubscribers
);

/**
 * @swagger
 * /api/v1/admin/newsletter/{id}:
 *   delete:
 *     summary: Delete a subscriber profile
 *     tags: [Newsletter - Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Subscriber deleted successfully
 */
router.delete(
  '/admin/newsletter/:id',
  requireAuth(),
  requirePermission('contact:delete'),
  contactController.deleteSubscriber
);

export default router;
