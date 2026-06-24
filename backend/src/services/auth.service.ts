import crypto from 'crypto';
import { AuthRepository } from '../repositories/auth.repository';
import { hashPassword, comparePassword } from '../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  JwtPayload,
} from '../utils/jwt';
import { getRedisClient } from '../config/redis';
import { AppError } from '../utils/app-error';
import { securityLogger } from '../config/logger';

/**
 * Normalizes email by trimming whitespace and converting to lowercase
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Computes the SHA-256 hex digest of a token
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class AuthService {
  private authRepository: AuthRepository;

  constructor() {
    this.authRepository = new AuthRepository();
  }

  private async redisReady(): Promise<boolean> {
    const redis = getRedisClient();
    return redis.status === 'ready';
  }

  /**
   * Checks if an account is currently locked out
   */
  private async checkLockout(email: string): Promise<void> {
    if (!(await this.redisReady())) return;
    const redis = getRedisClient();
    const isLocked = await redis.get(`auth:locked:${email}`);
    if (isLocked) {
      throw new AppError(
        'Account is locked due to multiple failed login attempts. Please try again in 15 minutes.',
        403,
        'ACCOUNT_LOCKED'
      );
    }
  }

  /**
   * Increments failed login count and triggers lockout if max attempts are reached
   */
  private async handleFailedAttempt(email: string): Promise<void> {
    if (!(await this.redisReady())) return;
    const redis = getRedisClient();
    const attemptsKey = `auth:failed_attempts:${email}`;
    const lockedKey = `auth:locked:${email}`;

    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) {
      await redis.expire(attemptsKey, 900); // 15 minutes expiry window
    }

    if (attempts >= 5) {
      await redis.set(lockedKey, 'true', 'EX', 900); // Lockout for 15 minutes
      await redis.del(attemptsKey); // Clear attempts key once locked
      securityLogger.warn({ email }, 'ACCOUNT_LOCKED');
    }
  }

  /**
   * Resets failed login counters on success
   */
  private async resetAttempts(email: string): Promise<void> {
    if (!(await this.redisReady())) return;
    const redis = getRedisClient();
    // Parallel delete — both keys are independent
    await Promise.all([
      redis.del(`auth:failed_attempts:${email}`),
      redis.del(`auth:locked:${email}`),
    ]);
  }

  /**
   * Registers a new customer
   */
  async register(data: { email: string; password: string; name: string }) {
    const normalized = normalizeEmail(data.email);

    // Run duplicate check, role lookup, and password hash in parallel
    // All three are independent of each other — eliminates 2 sequential round-trips
    const [existing, customerRole, hashed] = await Promise.all([
      this.authRepository.findUserByEmail(normalized),
      this.authRepository.findRoleByName('CUSTOMER'),
      hashPassword(data.password),
    ]);

    if (existing) {
      throw new AppError('Email address is already registered.', 409, 'DUPLICATE_EMAIL');
    }

    if (!customerRole) {
      throw new AppError('Default role not configured in system.', 500, 'ROLE_NOT_FOUND');
    }

    // Create user
    const user = await this.authRepository.createUser({
      email: normalized,
      passwordHash: hashed,
      name: data.name,
      roleId: customerRole.id,
    });

    // Create session and issue tokens
    const jti = crypto.randomUUID();
    const accessToken = generateAccessToken(
      {
        userId: user.id,
        email: user.email,
        roleName: user.role.name,
      },
      jti
    );
    const refreshToken = generateRefreshToken(
      {
        userId: user.id,
        email: user.email,
        roleName: user.role.name,
      },
      jti
    );

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.authRepository.createSession({
      id: jti,
      userId: user.id,
      refreshToken: tokenHash,
      expiresAt,
    });

    securityLogger.info({ userId: user.id, email: user.email }, 'USER_REGISTERED');

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Logs a user in, verifies credentials, and issues session tokens
   */
  async login(
    data: { email: string; password: string },
    meta: { ipAddress?: string; deviceInfo?: string }
  ) {
    const normalized = normalizeEmail(data.email);

    // 1. Verify lockout status
    await this.checkLockout(normalized);

    // 2. Lookup user
    const user = await this.authRepository.findUserByEmail(normalized);
    if (!user) {
      await this.handleFailedAttempt(normalized);
      securityLogger.warn({ email: normalized }, 'LOGIN_FAILURE_EMAIL_NOT_FOUND');
      throw new AppError(
        'Invalid email or password credentials.',
        401,
        'INVALID_CREDENTIALS'
      );
    }

    // 3. Verify password
    const isPasswordValid = await comparePassword(data.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.handleFailedAttempt(normalized);
      securityLogger.warn(
        { userId: user.id, email: normalized },
        'LOGIN_FAILURE_WRONG_PASSWORD'
      );
      throw new AppError(
        'Invalid email or password credentials.',
        401,
        'INVALID_CREDENTIALS'
      );
    }

    // 4. Reset brute force attempts
    await this.resetAttempts(normalized);

    // 5. Create new session
    const jti = crypto.randomUUID();
    const accessToken = generateAccessToken(
      {
        userId: user.id,
        email: user.email,
        roleName: user.role.name,
      },
      jti
    );
    const refreshToken = generateRefreshToken(
      {
        userId: user.id,
        email: user.email,
        roleName: user.role.name,
      },
      jti
    );

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.authRepository.createSession({
      id: jti,
      userId: user.id,
      refreshToken: tokenHash,
      ipAddress: meta.ipAddress,
      deviceInfo: meta.deviceInfo,
      expiresAt,
    });

    securityLogger.info({ userId: user.id, email: user.email }, 'LOGIN_SUCCESS');

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Rotates access and refresh tokens, preventing replay hijack attacks
   */
  async rotateTokens(
    oldToken: string,
    meta: { ipAddress?: string; deviceInfo?: string }
  ) {
    let payload: JwtPayload;
    try {
      payload = verifyRefreshToken(oldToken);
    } catch {
      throw new AppError('Invalid refresh token.', 401, 'INVALID_TOKEN');
    }

    const oldHash = hashToken(oldToken);
    const session = await this.authRepository.findSessionByTokenHash(oldHash);

    // ── Replay Attack Detection ──
    if (!session) {
      if (!(await this.redisReady())) {
        throw new AppError('Active session not found.', 401, 'SESSION_NOT_FOUND');
      }
      const redis = getRedisClient();
      const wasRotated = await redis.get(`auth:rotated_token:${oldHash}`);
      if (wasRotated) {
        // Token was rotated previously! Revoke all sessions immediately.
        await this.authRepository.deleteUserSessions(payload.userId);
        securityLogger.error(
          { userId: payload.userId, tokenHash: oldHash },
          'REFRESH_TOKEN_REPLAY_ATTACK'
        );
        throw new AppError(
          'Security alert: Refresh token reuse detected. Access revoked on all devices.',
          401,
          'REPLAY_ATTACK_DETECTED'
        );
      }
      throw new AppError('Active session not found.', 401, 'SESSION_NOT_FOUND');
    }

    // Check expiry
    if (new Date() > session.expiresAt) {
      await this.authRepository.deleteSession(session.id);
      throw new AppError('Refresh token expired.', 401, 'TOKEN_EXPIRED');
    }

    // 1. Delete old session
    await this.authRepository.deleteSession(session.id);

    // 2. Register old hash in Redis as rotated for 7 days (prevents replay)
    if (await this.redisReady()) {
      const redis = getRedisClient();
      await redis.set(
        `auth:rotated_token:${oldHash}`,
        payload.userId,
        'EX',
        7 * 24 * 60 * 60
      );
    }

    // 3. Issue new tokens
    const newJti = crypto.randomUUID();
    const accessToken = generateAccessToken(
      {
        userId: session.user.id,
        email: session.user.email,
        roleName: session.user.role.name,
      },
      newJti
    );
    const refreshToken = generateRefreshToken(
      {
        userId: session.user.id,
        email: session.user.email,
        roleName: session.user.role.name,
      },
      newJti
    );

    const newHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.authRepository.createSession({
      id: newJti,
      userId: session.user.id,
      refreshToken: newHash,
      ipAddress: meta.ipAddress,
      deviceInfo: meta.deviceInfo,
      expiresAt,
    });

    securityLogger.info({ userId: session.user.id }, 'SESSION_ROTATED');

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Invalidates a specific session (Logout)
   */
  async logout(token: string): Promise<void> {
    try {
      const payload = verifyRefreshToken(token);
      const tokenHash = hashToken(token);
      const session = await this.authRepository.findSessionByTokenHash(tokenHash);
      if (session) {
        await this.authRepository.deleteSession(session.id);
      }
      securityLogger.info({ userId: payload.userId }, 'LOGOUT');
    } catch {
      // Return cleanly even if token validation fails during logout
    }
  }

  /**
   * Revokes all active sessions for a user (Logout All)
   */
  async logoutAll(userId: string): Promise<void> {
    await this.authRepository.deleteUserSessions(userId);
    securityLogger.info({ userId }, 'LOGOUT_ALL');
  }

  /**
   * Retrieves profile, role, and database-driven permission lists for a user
   */
  async getProfile(userId: string) {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new AppError('User profile not found.', 404, 'USER_NOT_FOUND');
    }

    const relations = await this.authRepository.findRolePermissions(user.roleId);
    const permissions = relations.map((rel) => rel.permission.name);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      role: user.role.name,
      permissions,
    };
  }

  /**
   * Updates password and invalidates all existing sessions
   */
  async changePassword(
    userId: string,
    data: { oldPassword: string; newPassword: string },
    meta: { ipAddress?: string; deviceInfo?: string }
  ) {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new AppError('User profile not found.', 404, 'USER_NOT_FOUND');
    }

    // Verify current password
    const isPasswordValid = await comparePassword(data.oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      securityLogger.warn({ userId }, 'PASSWORD_CHANGE_FAILED_INVALID_OLD_PASSWORD');
      throw new AppError('Invalid current password.', 400, 'INVALID_CURRENT_PASSWORD');
    }

    // Hash new password first, then update credentials and invalidate sessions in parallel
    const hashed = await hashPassword(data.newPassword);
    await Promise.all([
      this.authRepository.updateUserPassword(user.id, hashed),
      this.authRepository.deleteUserSessions(user.id),
    ]);
    securityLogger.info({ userId }, 'PASSWORD_CHANGED_SESSIONS_REVOKED');

    // Create a new active session
    const jti = crypto.randomUUID();
    const accessToken = generateAccessToken(
      {
        userId: user.id,
        email: user.email,
        roleName: user.role.name,
      },
      jti
    );
    const refreshToken = generateRefreshToken(
      {
        userId: user.id,
        email: user.email,
        roleName: user.role.name,
      },
      jti
    );

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.authRepository.createSession({
      id: jti,
      userId: user.id,
      refreshToken: tokenHash,
      ipAddress: meta.ipAddress,
      deviceInfo: meta.deviceInfo,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}
export default AuthService;
