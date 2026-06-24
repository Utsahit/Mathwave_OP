import { getRedisClient } from '../config/redis';
import { logger } from '../config/logger';

const LOCK_TTL_MS = 10000; // 10 second TTL — auto-expires to prevent deadlocks

/**
 * Lua script for atomic lock release.
 * Only deletes the key if the stored value matches the caller's token,
 * preventing a lock holder from releasing another holder's lock.
 */
const RELEASE_LOCK_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  else
    return 0
  end
`;

export class ReservationLockService {
  /**
   * Generates the Redis key for a reservation slot lock.
   */
  private lockKey(date: string, timeSlot: string, tableId: string): string {
    return `lock:res:${date}:${timeSlot}:${tableId}`;
  }

  /**
   * Attempts to acquire a distributed lock for a reservation slot.
   * Uses SET NX PX (set-if-not-exists with millisecond expiry) for atomicity.
   *
   * @returns The lock token string on success, or null if the lock is held.
   */
  async acquireLock(
    date: string,
    timeSlot: string,
    tableId: string
  ): Promise<string | null> {
    try {
      const redis = getRedisClient();
      const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const key = this.lockKey(date, timeSlot, tableId);

      // Use setex + get-then-compare for ioredis v5 compatibility
      // SET key token PX ttl NX — atomically set only if not exists
      const result = await redis.set(key, token, 'PX', LOCK_TTL_MS, 'NX');

      if (result === 'OK') {
        logger.debug({ key, token }, 'Reservation lock acquired.');
        return token;
      }

      logger.warn(
        { key },
        'Reservation lock already held — concurrent booking attempt blocked.'
      );
      return null;
    } catch (err) {
      // If Redis is unavailable, allow the operation to proceed (degrade gracefully)
      logger.error({ err }, 'Redis lock acquire failed — proceeding without lock.');
      return 'no-lock';
    }
  }

  /**
   * Releases a previously acquired lock using an atomic Lua CAS script.
   * Safe to call even if Redis is unavailable.
   */
  async releaseLock(
    date: string,
    timeSlot: string,
    tableId: string,
    token: string
  ): Promise<void> {
    if (token === 'no-lock') return; // Redis was unavailable at acquire time

    try {
      const redis = getRedisClient();
      const key = this.lockKey(date, timeSlot, tableId);
      await redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
      logger.debug({ key }, 'Reservation lock released.');
    } catch (err) {
      // Lock will auto-expire via TTL — no action required
      logger.error({ err }, 'Redis lock release failed — lock will auto-expire.');
    }
  }

  /**
   * Checks whether a lock is currently held for a slot (diagnostic only).
   */
  async isLocked(date: string, timeSlot: string, tableId: string): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const val = await redis.get(this.lockKey(date, timeSlot, tableId));
      return val !== null;
    } catch {
      return false;
    }
  }
}

export const reservationLockService = new ReservationLockService();
