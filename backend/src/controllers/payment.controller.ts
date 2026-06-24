import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service';
import { sendSuccess } from '../utils/response';

export class PaymentController {
  createPayment = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { orderId } = req.body;
      if (!orderId) {
        res.status(400).json({ success: false, message: 'Order ID is required.' });
        return;
      }
      const paymentDetails = await paymentService.createRazorpayOrder(orderId);
      sendSuccess(res, 'Razorpay order created successfully.', paymentDetails);
    } catch (err) {
      next(err);
    }
  };

  verifyPayment = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
      const orderId = req.body.orderId;
      const transaction = await paymentService.verifyPaymentSignature({
        orderId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });
      sendSuccess(res, 'Payment verified successfully.', transaction);
    } catch (err) {
      next(err);
    }
  };

  handleWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const signatureHeader = req.headers['x-razorpay-signature'] as string;
      if (!signatureHeader) {
        res
          .status(400)
          .json({ success: false, message: 'Webhook signature is required.' });
        return;
      }

      const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : JSON.stringify(req.body);

      const result = await paymentService.processWebhook(signatureHeader, rawBody);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export const paymentController = new PaymentController();
