import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { addressService } from '../services/address.service';
import { sendSuccess } from '../utils/response';

export class AddressController {
  listAddresses = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await addressService.listAddresses(req.user!.userId, page, limit);
      sendSuccess(res, 'Addresses retrieved successfully.', result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (err) {
      next(err);
    }
  };

  createAddress = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const address = await addressService.createAddress(req.user!.userId, req.body);
      sendSuccess(res, 'Address created successfully.', address, {}, 201);
    } catch (err) {
      next(err);
    }
  };

  updateAddress = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const address = await addressService.updateAddress(
        req.params.id,
        req.user!.userId,
        req.body
      );
      sendSuccess(res, 'Address updated successfully.', address);
    } catch (err) {
      next(err);
    }
  };

  deleteAddress = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await addressService.deleteAddress(req.params.id, req.user!.userId);
      sendSuccess(res, 'Address deleted successfully.');
    } catch (err) {
      next(err);
    }
  };
}

export const addressController = new AddressController();
