import { Router } from 'express';
import { reviewController } from '../controllers/review.controller';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { branchScopeMiddleware } from '../middleware/branch-context';
import { reviewLimiter } from '../middleware/rate-limiter';
import {
  createReviewSchema,
  updateReviewSchema,
  publicReviewQuerySchema,
  adminReviewQuerySchema,
} from '../validators/review.validator';

const router = Router();

// ── Public Review Endpoints ──────────────────────────────────────────────────
/**
 * @swagger
 * /api/v1/reviews/featured:
 *   get:
 *     summary: Get featured reviews for homepage testimonials
 *     tags: [Reviews - Public]
 *     responses:
 *       200:
 *         description: List of approved + featured reviews
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PublicReview'
 */
router.get('/reviews/featured', reviewController.getFeaturedReviews);

/**
 * @swagger
 * /api/v1/reviews/stats:
 *   get:
 *     summary: Get review statistics (averageRating, totalReviews, ratingDistribution)
 *     tags: [Reviews - Public]
 *     responses:
 *       200:
 *         description: Aggregated review statistics
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 averageRating: 4.6
 *                 totalReviews: 142
 *                 ratingDistribution: { "1": 2, "2": 5, "3": 10, "4": 48, "5": 77 }
 */
router.get('/reviews/stats', reviewController.getStats);

/**
 * @swagger
 * /api/v1/reviews:
 *   get:
 *     summary: List approved public reviews (paginated)
 *     tags: [Reviews - Public]
 *     parameters:
 *       - in: query
 *         name: rating
 *         schema: { type: integer, minimum: 1, maximum: 5 }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 */
router.get(
  '/reviews',
  validate({ query: publicReviewQuerySchema }),
  reviewController.listPublicReviews
);

/**
 * @swagger
 * /api/v1/reviews:
 *   post:
 *     summary: Submit a public review (requires moderation before visibility)
 *     tags: [Reviews - Public]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, rating, comment]
 *             properties:
 *               name:    { type: string, example: "Priya Sharma" }
 *               email:   { type: string, format: email }
 *               title:   { type: string, example: "Wonderful dining experience" }
 *               rating:  { type: integer, minimum: 1, maximum: 5 }
 *               comment: { type: string, minLength: 10, maxLength: 1000 }
 *     responses:
 *       201: { description: Review submitted — pending moderation }
 *       422: { description: Profanity detected }
 *       429: { description: Rate limited or email cooldown }
 */
router.post(
  '/reviews',
  reviewLimiter,
  validate({ body: createReviewSchema }),
  reviewController.submitReview
);

// ── Admin Review Endpoints ───────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/admin/reviews:
 *   get:
 *     summary: Admin — list all reviews with filters
 *     tags: [Reviews - Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isApproved
 *         schema: { type: boolean }
 *       - in: query
 *         name: isFeatured
 *         schema: { type: boolean }
 *       - in: query
 *         name: rating
 *         schema: { type: integer, minimum: 1, maximum: 5 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: Paginated review list }
 *       403: { description: Insufficient permissions }
 */
router.get(
  '/admin/reviews',
  requireAuth(),
  requirePermission('review:view'),
  branchScopeMiddleware,
  validate({ query: adminReviewQuerySchema }),
  reviewController.adminListReviews
);

/**
 * @swagger
 * /api/v1/admin/reviews/{id}:
 *   get:
 *     summary: Admin — get single review by ID
 *     tags: [Reviews - Admin]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  '/admin/reviews/:id',
  requireAuth(),
  requirePermission('review:view'),
  reviewController.getReview
);

/**
 * @swagger
 * /api/v1/admin/reviews/{id}:
 *   put:
 *     summary: Admin — edit review content
 *     tags: [Reviews - Admin]
 *     security:
 *       - BearerAuth: []
 */
router.put(
  '/admin/reviews/:id',
  requireAuth(),
  requirePermission('review:approve'),
  validate({ body: updateReviewSchema }),
  reviewController.updateReview
);

/**
 * @swagger
 * /api/v1/admin/reviews/{id}:
 *   delete:
 *     summary: Admin — permanently delete a review
 *     tags: [Reviews - Admin]
 *     security:
 *       - BearerAuth: []
 */
router.delete(
  '/admin/reviews/:id',
  requireAuth(),
  requirePermission('review:delete'),
  reviewController.deleteReview
);

/**
 * @swagger
 * /api/v1/admin/reviews/{id}/approve:
 *   put:
 *     summary: Admin — approve a review (makes it publicly visible)
 *     tags: [Reviews - Admin]
 *     security:
 *       - BearerAuth: []
 */
router.put(
  '/admin/reviews/:id/approve',
  requireAuth(),
  requirePermission('review:approve'),
  reviewController.approveReview
);

/**
 * @swagger
 * /api/v1/admin/reviews/{id}/reject:
 *   put:
 *     summary: Admin — reject/un-approve a review
 *     tags: [Reviews - Admin]
 *     security:
 *       - BearerAuth: []
 */
router.put(
  '/admin/reviews/:id/reject',
  requireAuth(),
  requirePermission('review:approve'),
  reviewController.rejectReview
);

/**
 * @swagger
 * /api/v1/admin/reviews/{id}/feature:
 *   put:
 *     summary: Admin — feature review on homepage (must be approved first)
 *     tags: [Reviews - Admin]
 *     security:
 *       - BearerAuth: []
 */
router.put(
  '/admin/reviews/:id/feature',
  requireAuth(),
  requirePermission('review:feature'),
  reviewController.featureReview
);

/**
 * @swagger
 * /api/v1/admin/reviews/{id}/unfeature:
 *   put:
 *     summary: Admin — remove review from homepage featured list
 *     tags: [Reviews - Admin]
 *     security:
 *       - BearerAuth: []
 */
router.put(
  '/admin/reviews/:id/unfeature',
  requireAuth(),
  requirePermission('review:feature'),
  reviewController.unfeatureReview
);

export default router;
