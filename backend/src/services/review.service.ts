import { getRedisClient } from '../config/redis';
import { reviewRepository } from '../repositories/review.repository';
import { AppError } from '../utils/app-error';
import { logger } from '../config/logger';
import { notificationService } from './notification.service';
import { auditService } from './audit.service';

// ── Cache TTLs ────────────────────────────────────────────────────────────────
const TTL_FEATURED = 3600; // 1 hour
const TTL_STATS = 3600; // 1 hour
const TTL_LIST = 3600; // 1 hour

// ── Anti-spam config ──────────────────────────────────────────────────────────
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h between reviews from same email
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1h window
const RATE_LIMIT_MAX = 3; // max 3 submissions per hour per IP

// ── Basic profanity hook (extend wordlist as needed) ─────────────────────────
const PROFANITY_LIST = [
  'spam',
  'scam',
  'fake',
  'fraud',
  'shit',
  'fuck',
  'ass',
  'bitch',
  'crap',
];

function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return PROFANITY_LIST.some((word) => lower.includes(word));
}

// ── Cache helpers ─────────────────────────────────────────────────────────────
async function redisGet<T>(key: string): Promise<T | null> {
  try {
    const val = await getRedisClient().get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

async function redisSet(key: string, data: unknown, ttl: number): Promise<void> {
  try {
    await getRedisClient().set(key, JSON.stringify(data), 'EX', ttl);
  } catch {
    // Non-critical — cache miss is acceptable
  }
}

async function invalidateReviewCaches(): Promise<void> {
  try {
    const redis = getRedisClient();
    await Promise.all([redis.del('reviews:featured'), redis.del('reviews:stats')]);
  } catch {
    // Non-critical
  }
}

export class ReviewService {
  // ── Public: Submit Review ──────────────────────────────────────────────────

  async submitReview(
    data: {
      name: string;
      email: string;
      title?: string;
      rating: number;
      comment: string;
      userId?: string;
    },
    clientIp: string
  ) {
    // 1. IP-based rate limiting via Redis
    const ipKey = `review:rate:${clientIp}`;
    try {
      const redis = getRedisClient();
      const count = await redis.incr(ipKey);
      if (count === 1) await redis.expire(ipKey, RATE_LIMIT_WINDOW_MS / 1000);
      if (count > RATE_LIMIT_MAX) {
        throw new AppError(
          'Too many review submissions. Please try again in an hour.',
          429,
          'RATE_LIMITED'
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.warn({ err }, 'Redis rate-limit check failed — proceeding without limit.');
    }

    // 2. Email cooldown (one review per email per 24h)
    const recent = await reviewRepository.findRecentByEmail(data.email, COOLDOWN_MS);
    if (recent) {
      throw new AppError(
        'A review from this email was submitted recently. Please wait 24 hours before submitting again.',
        429,
        'EMAIL_COOLDOWN'
      );
    }

    // 3. Profanity check
    const textToCheck = `${data.title ?? ''} ${data.comment}`;
    if (containsProfanity(textToCheck)) {
      throw new AppError(
        'Your review contains inappropriate language. Please revise and resubmit.',
        422,
        'PROFANITY_DETECTED'
      );
    }

    // 4. Create (pending moderation — isApproved = false)
    const review = await reviewRepository.createReview(data);

    // 5. Invalidate caches (stats may change once approved later)
    await invalidateReviewCaches();

    logger.info(
      { id: review.id, email: data.email },
      'New review submitted — pending moderation.'
    );
    return review;
  }

  // ── Public: List Approved Reviews (cached) ─────────────────────────────────

  async listPublicReviews(filters: { rating?: number; page: number; limit: number }) {
    const cacheKey = `reviews:list:${filters.rating ?? 'all'}:${filters.page}:${filters.limit}`;
    const cached = await redisGet<{ items: Record<string, unknown>[]; total: number }>(
      cacheKey
    );
    if (cached) return cached;

    const result = await reviewRepository.listApprovedReviews(filters);
    await redisSet(cacheKey, result, TTL_LIST);
    return result;
  }

  // ── Public: Featured Reviews (cached) ─────────────────────────────────────

  async getFeaturedReviews() {
    const cacheKey = 'reviews:featured';
    const cached = await redisGet<Record<string, unknown>[]>(cacheKey);
    if (cached) return cached;

    const items = await reviewRepository.listFeaturedReviews();
    await redisSet(cacheKey, items, TTL_FEATURED);
    return items;
  }

  // ── Public: Stats (cached) ────────────────────────────────────────────────

  async getStats() {
    const cacheKey = 'reviews:stats';
    const cached = await redisGet<{
      averageRating: number;
      totalReviews: number;
      ratingDistribution: Record<number, number>;
    }>(cacheKey);
    if (cached) return cached;

    const stats = await reviewRepository.getStats();
    await redisSet(cacheKey, stats, TTL_STATS);
    return stats;
  }

  // ── Admin: List All Reviews ────────────────────────────────────────────────

  async adminListReviews(filters: {
    isApproved?: boolean;
    isFeatured?: boolean;
    rating?: number;
    search?: string;
    page: number;
    limit: number;
    branchIds?: string[];
  }) {
    return reviewRepository.listReviews(filters);
  }

  // ── Admin: Get Single Review ───────────────────────────────────────────────

  async getReview(id: string) {
    const review = await reviewRepository.findById(id);
    if (!review) throw new AppError('Review not found.', 404, 'REVIEW_NOT_FOUND');
    return review;
  }

  // ── Admin: Update Review ───────────────────────────────────────────────────

  async updateReview(
    id: string,
    data: { name?: string; title?: string; comment?: string; rating?: number }
  ) {
    await this.getReview(id);
    const updated = await reviewRepository.updateReview(id, data);
    await invalidateReviewCaches();
    return updated;
  }

  // ── Admin: Delete Review ───────────────────────────────────────────────────

  async deleteReview(id: string) {
    await this.getReview(id);
    await reviewRepository.deleteReview(id);
    await invalidateReviewCaches();
  }

  // ── Admin: Approve / Reject ────────────────────────────────────────────────

  async approveReview(id: string) {
    const review = await this.getReview(id);
    const updated = await reviewRepository.setApproved(id, true);
    await invalidateReviewCaches();
    if (review.email) {
      notificationService
        .create(
          review.userId,
          review.email,
          'REVIEW_APPROVED',
          'Review Approved',
          'Your review has been approved and is now visible.',
          'IN_APP',
          { reviewId: id }
        )
        .catch(() => {});
    }
    auditService
      .logUpdate(null, 'Review', id, { isApproved: false }, { isApproved: true })
      .catch(() => {});
    logger.info({ id }, 'Review approved.');
    return updated;
  }

  async rejectReview(id: string) {
    await this.getReview(id);
    const updated = await reviewRepository.setApproved(id, false);
    await invalidateReviewCaches();
    return updated;
  }

  // ── Admin: Feature / Unfeature ────────────────────────────────────────────

  async featureReview(id: string) {
    const review = await this.getReview(id);
    if (!review.isApproved) {
      throw new AppError(
        'Only approved reviews can be featured.',
        422,
        'REVIEW_NOT_APPROVED'
      );
    }
    const updated = await reviewRepository.setFeatured(id, true);
    await invalidateReviewCaches();
    logger.info({ id }, 'Review featured on homepage.');
    return updated;
  }

  async unfeatureReview(id: string) {
    await this.getReview(id);
    const updated = await reviewRepository.setFeatured(id, false);
    await invalidateReviewCaches();
    return updated;
  }
}

export const reviewService = new ReviewService();
