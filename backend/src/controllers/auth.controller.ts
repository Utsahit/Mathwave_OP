import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AuthService } from '../services/auth.service';
import { sendSuccess } from '../utils/response';

/**
 * Controller class to handle Express authentication requests
 */
export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * POST /api/v1/auth/register
   */
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.register(req.body);
      sendSuccess(res, 'Registration successful', result, {}, 201);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/auth/login
   */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress || undefined;
      const deviceInfo = req.headers['user-agent'] || undefined;
      const result = await this.authService.login(req.body, { ipAddress, deviceInfo });
      sendSuccess(res, 'Login successful', result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/auth/refresh
   */
  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress || undefined;
      const deviceInfo = req.headers['user-agent'] || undefined;
      const result = await this.authService.rotateTokens(req.body.refreshToken, {
        ipAddress,
        deviceInfo,
      });
      sendSuccess(res, 'Tokens rotated successfully', result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/auth/logout
   */
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.logout(req.body.refreshToken);
      sendSuccess(res, 'Logout successful');
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/auth/logout-all
   */
  logoutAll = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      await this.authService.logoutAll(userId);
      sendSuccess(res, 'Logged out from all sessions successfully');
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/auth/me
   */
  me = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const result = await this.authService.getProfile(userId);
      sendSuccess(res, 'User profile retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/auth/change-password
   */
  changePassword = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const ipAddress = req.ip || req.socket.remoteAddress || undefined;
      const deviceInfo = req.headers['user-agent'] || undefined;
      const result = await this.authService.changePassword(userId, req.body, {
        ipAddress,
        deviceInfo,
      });
      sendSuccess(res, 'Password changed successfully. Active sessions revoked.', result);
    } catch (error) {
      next(error);
    }
  };
}

export default AuthController;
