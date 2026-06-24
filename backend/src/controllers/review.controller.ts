import { Request, Response, NextFunction } from 'express';
import { reviewService } from '../services/review.service';
import { sendSuccess } from '../utils/response';

export class ReviewController {
  // ── Public ──────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/reviews
   * Returns paginated approved reviews, optionally filtered by rating.
   */
  listPublicReviews = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = (req.query.page as unknown as number) || 1;
      const limit = (req.query.limit as unknown as number) || 10;
      const rating = req.query.rating as unknown as number | undefined;

      const result = await reviewService.listPublicReviews({ rating, page, limit });
      sendSuccess(res, 'Reviews retrieved successfully.', result.items, {
        page,
        limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/reviews/featured
   * Returns approved + featured reviews for homepage testimonials.
   */
  getFeaturedReviews = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const items = await reviewService.getFeaturedReviews();
      sendSuccess(res, 'Featured reviews retrieved successfully.', items);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/reviews/stats
   * Returns averageRating, totalReviews, ratingDistribution.
   */
  getStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await reviewService.getStats();
      sendSuccess(res, 'Review statistics retrieved successfully.', stats);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/reviews
   * Public review submission — always creates as isApproved=false.
   */
  submitReview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        req.ip ||
        'unknown';

      const userId = (req as unknown as { user?: { userId?: string } }).user?.userId;

      const review = await reviewService.submitReview(
        {
          name: req.body.name,
          email: req.body.email,
          title: req.body.title,
          rating: req.body.rating,
          comment: req.body.comment,
          userId,
        },
        clientIp
      );

      res.status(201).json({
        success: true,
        message: 'Thank you for your review! It will be visible after moderation.',
        data: review,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  };

  // ── Admin ────────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/admin/reviews
   */
  adminListReviews = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = (req.query.page as unknown as number) || 1;
      const limit = (req.query.limit as unknown as number) || 20;
      const isApproved = req.query.isApproved as boolean | undefined;
      const isFeatured = req.query.isFeatured as boolean | undefined;
      const rating = req.query.rating as unknown as number | undefined;
      const search = req.query.search as string | undefined;
      const branchScope = (req as any).user ? req.branchScope : undefined;
      const branchIds =
        branchScope === undefined || branchScope === null ? undefined : branchScope;

      const result = await reviewService.adminListReviews({
        isApproved,
        isFeatured,
        rating,
        search,
        page,
        limit,
        branchIds,
      });

      sendSuccess(res, 'Reviews retrieved successfully.', result.items, {
        page,
        limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/admin/reviews/:id
   */
  getReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const review = await reviewService.getReview(req.params.id);
      sendSuccess(res, 'Review retrieved successfully.', review);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PUT /api/v1/admin/reviews/:id
   */
  updateReview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const updated = await reviewService.updateReview(req.params.id, req.body);
      sendSuccess(res, 'Review updated successfully.', updated);
    } catch (err) {
      next(err);
    }
  };

  /**
   * DELETE /api/v1/admin/reviews/:id
   */
  deleteReview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await reviewService.deleteReview(req.params.id);
      sendSuccess(res, 'Review deleted successfully.', null);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PUT /api/v1/admin/reviews/:id/approve
   */
  approveReview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const updated = await reviewService.approveReview(req.params.id);
      sendSuccess(res, 'Review approved successfully.', updated);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PUT /api/v1/admin/reviews/:id/reject
   */
  rejectReview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const updated = await reviewService.rejectReview(req.params.id);
      sendSuccess(res, 'Review rejected successfully.', updated);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PUT /api/v1/admin/reviews/:id/feature
   */
  featureReview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const updated = await reviewService.featureReview(req.params.id);
      sendSuccess(res, 'Review featured successfully.', updated);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PUT /api/v1/admin/reviews/:id/unfeature
   */
  unfeatureReview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const updated = await reviewService.unfeatureReview(req.params.id);
      sendSuccess(res, 'Review unfeatured successfully.', updated);
    } catch (err) {
      next(err);
    }
  };
}

export const reviewController = new ReviewController();
