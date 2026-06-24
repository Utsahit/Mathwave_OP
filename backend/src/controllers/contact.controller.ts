import { Request, Response, NextFunction } from 'express';
import { contactService } from '../services/contact.service';
import { sendSuccess } from '../utils/response';

export class ContactController {
  // ── Contact Inquiries ──────────────────────────────────────────────────────

  submitContactMessage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        req.ip ||
        'unknown';

      const msg = await contactService.submitContactMessage(
        {
          name: req.body.name,
          email: req.body.email,
          subject: req.body.subject,
          message: req.body.message,
        },
        clientIp
      );

      res.status(201).json({
        success: true,
        message: 'Your inquiry has been received successfully.',
        data: msg,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  };

  adminListMessages = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = (req.query.page as unknown as number) || 1;
      const limit = (req.query.limit as unknown as number) || 20;
      const isRead = req.query.isRead as boolean | undefined;
      const search = req.query.search as string | undefined;
      const sortBy = (req.query.sortBy as 'createdAt' | 'email') || 'createdAt';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';
      const branchScope = (req as any).user ? req.branchScope : undefined;
      const branchIds =
        branchScope === undefined || branchScope === null ? undefined : branchScope;

      const result = await contactService.listMessages({
        isRead,
        search,
        page,
        limit,
        sortBy,
        sortOrder,
        branchIds,
      });

      sendSuccess(res, 'Inquiries retrieved successfully.', result.items, {
        page,
        limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };

  getContactMessage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const msg = await contactService.getMessage(req.params.id);
      sendSuccess(res, 'Inquiry retrieved successfully.', msg);
    } catch (err) {
      next(err);
    }
  };

  markRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isRead = req.body.isRead === undefined ? true : !!req.body.isRead;
      const updated = await contactService.markRead(req.params.id, isRead);
      sendSuccess(res, 'Inquiry status updated successfully.', updated);
    } catch (err) {
      next(err);
    }
  };

  softDeleteMessage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await contactService.softDeleteMessage(req.params.id);
      sendSuccess(res, 'Inquiry deleted successfully.', null);
    } catch (err) {
      next(err);
    }
  };

  getContactStats = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const stats = await contactService.getContactStats();
      sendSuccess(res, 'Inquiry statistics retrieved successfully.', stats);
    } catch (err) {
      next(err);
    }
  };

  // ── Newsletter Subscriptions ──────────────────────────────────────────────

  subscribeNewsletter = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const sub = await contactService.subscribeNewsletter(req.body.email);
      res.status(201).json({
        success: true,
        message: 'Successfully subscribed to the newsletter.',
        data: sub,
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  };

  unsubscribeNewsletter = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const unsub = await contactService.unsubscribeNewsletter(req.body.email);
      sendSuccess(res, 'Successfully unsubscribed from the newsletter.', unsub);
    } catch (err) {
      next(err);
    }
  };

  adminListSubscribers = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = (req.query.page as unknown as number) || 1;
      const limit = (req.query.limit as unknown as number) || 20;
      const isActive = req.query.isActive as boolean | undefined;
      const search = req.query.search as string | undefined;

      const result = await contactService.listSubscribers({
        isActive,
        search,
        page,
        limit,
      });

      sendSuccess(res, 'Subscribers retrieved successfully.', result.items, {
        page,
        limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };

  exportSubscribers = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const format = req.query.format as string | undefined;
      const exportData = await contactService.getSubscribersExport(format);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="newsletter_subscribers.csv"'
        );
        res.status(200).send(exportData);
        return;
      }

      sendSuccess(res, 'Subscribers exported successfully.', exportData);
    } catch (err) {
      next(err);
    }
  };

  deleteSubscriber = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await contactService.deleteSubscriber(req.params.id);
      sendSuccess(res, 'Subscriber deleted successfully.', null);
    } catch (err) {
      next(err);
    }
  };

  getNewsletterStats = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const stats = await contactService.getNewsletterStats();
      sendSuccess(res, 'Newsletter statistics retrieved successfully.', stats);
    } catch (err) {
      next(err);
    }
  };
}

export const contactController = new ContactController();
