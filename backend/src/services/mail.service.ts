import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

interface ReservationMailData {
  name: string;
  email: string;
  reservationCode: string;
  date: string;
  timeSlot: string;
  guests: number;
  tableNumber?: string | null;
  specialRequest?: string | null;
}

function createTransporter() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });
}

function confirmationTemplate(data: ReservationMailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reservation Confirmed — Elixir & Oak</title>
  <style>
    body { margin: 0; padding: 0; background: #0f0e0c; font-family: 'Georgia', serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #1a1814; border: 1px solid #3a3228; border-radius: 8px; overflow: hidden; }
    .header { background: #1a1814; padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #3a3228; }
    .logo { font-size: 24px; letter-spacing: 6px; color: #c9a96e; font-weight: normal; }
    .tagline { font-size: 11px; letter-spacing: 4px; color: #7a6a55; margin-top: 4px; }
    .body { padding: 40px; }
    .greeting { font-size: 22px; color: #f0e6d3; margin-bottom: 8px; }
    .sub { font-size: 14px; color: #9a8a75; line-height: 1.7; margin-bottom: 28px; }
    .code-box { background: #0f0e0c; border: 1px solid #c9a96e; border-radius: 6px; padding: 20px; text-align: center; margin-bottom: 28px; }
    .code-label { font-size: 11px; letter-spacing: 3px; color: #7a6a55; margin-bottom: 8px; }
    .code { font-size: 28px; letter-spacing: 8px; color: #c9a96e; font-family: 'Courier New', monospace; }
    .details { border-top: 1px solid #3a3228; padding-top: 24px; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #2a2520; }
    .detail-label { font-size: 12px; letter-spacing: 2px; color: #7a6a55; }
    .detail-value { font-size: 14px; color: #c9a96e; text-align: right; }
    .note { margin-top: 24px; padding: 16px; background: #0f0e0c; border-left: 3px solid #c9a96e; border-radius: 4px; }
    .note p { font-size: 13px; color: #9a8a75; margin: 0; line-height: 1.6; }
    .footer { background: #0f0e0c; padding: 24px 40px; text-align: center; border-top: 1px solid #3a3228; }
    .footer p { font-size: 11px; letter-spacing: 2px; color: #5a4a35; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">ELIXIR &amp; OAK</div>
      <div class="tagline">ARTISANAL BREWERY &amp; GASTRONOMY</div>
    </div>
    <div class="body">
      <div class="greeting">Your table is reserved, ${data.name.split(' ')[0]}.</div>
      <div class="sub">We look forward to welcoming you at Elixir &amp; Oak. Your reservation details are confirmed below.</div>
      <div class="code-box">
        <div class="code-label">RESERVATION CODE</div>
        <div class="code">${data.reservationCode}</div>
      </div>
      <div class="details">
        <div class="detail-row">
          <span class="detail-label">DATE</span>
          <span class="detail-value">${data.date}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">TIME</span>
          <span class="detail-value">${data.timeSlot}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">GUESTS</span>
          <span class="detail-value">${data.guests}</span>
        </div>
        ${data.tableNumber ? `<div class="detail-row"><span class="detail-label">TABLE</span><span class="detail-value">${data.tableNumber}</span></div>` : ''}
        ${data.specialRequest ? `<div class="detail-row"><span class="detail-label">SPECIAL REQUEST</span><span class="detail-value">${data.specialRequest}</span></div>` : ''}
      </div>
      <div class="note">
        <p>Please arrive 10 minutes before your reservation. To modify or cancel, contact us at <strong>hello@elixirandoak.in</strong> or call <strong>+91 98200 00000</strong>.</p>
      </div>
    </div>
    <div class="footer">
      <p>COLABA CAUSEWAY, COLABA, MUMBAI 400005</p>
      <p>hello@elixirandoak.in &nbsp;·&nbsp; +91 98200 00000</p>
    </div>
  </div>
</body>
</html>`;
}

function cancellationTemplate(data: ReservationMailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reservation Cancelled — Elixir & Oak</title>
  <style>
    body { margin: 0; padding: 0; background: #0f0e0c; font-family: 'Georgia', serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #1a1814; border: 1px solid #3a3228; border-radius: 8px; overflow: hidden; }
    .header { background: #1a1814; padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #3a3228; }
    .logo { font-size: 24px; letter-spacing: 6px; color: #c9a96e; font-weight: normal; }
    .tagline { font-size: 11px; letter-spacing: 4px; color: #7a6a55; margin-top: 4px; }
    .body { padding: 40px; }
    .greeting { font-size: 22px; color: #f0e6d3; margin-bottom: 8px; }
    .sub { font-size: 14px; color: #9a8a75; line-height: 1.7; margin-bottom: 28px; }
    .code-box { background: #0f0e0c; border: 1px solid #5a4a35; border-radius: 6px; padding: 20px; text-align: center; margin-bottom: 28px; }
    .code-label { font-size: 11px; letter-spacing: 3px; color: #7a6a55; margin-bottom: 8px; }
    .code { font-size: 28px; letter-spacing: 8px; color: #9a8a75; font-family: 'Courier New', monospace; }
    .note { margin-top: 24px; padding: 16px; background: #0f0e0c; border-left: 3px solid #5a4a35; border-radius: 4px; }
    .note p { font-size: 13px; color: #9a8a75; margin: 0; line-height: 1.6; }
    .footer { background: #0f0e0c; padding: 24px 40px; text-align: center; border-top: 1px solid #3a3228; }
    .footer p { font-size: 11px; letter-spacing: 2px; color: #5a4a35; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">ELIXIR &amp; OAK</div>
      <div class="tagline">ARTISANAL BREWERY &amp; GASTRONOMY</div>
    </div>
    <div class="body">
      <div class="greeting">Your reservation has been cancelled.</div>
      <div class="sub">We're sorry to see you go. Your reservation (${data.reservationCode}) for ${data.date} at ${data.timeSlot} has been cancelled. We hope to welcome you another time.</div>
      <div class="code-box">
        <div class="code-label">CANCELLED RESERVATION</div>
        <div class="code">${data.reservationCode}</div>
      </div>
      <div class="note">
        <p>If you believe this cancellation was made in error, please contact us immediately at <strong>hello@elixirandoak.in</strong> or call <strong>+91 98200 00000</strong>.</p>
      </div>
    </div>
    <div class="footer">
      <p>COLABA CAUSEWAY, COLABA, MUMBAI 400005</p>
      <p>hello@elixirandoak.in &nbsp;·&nbsp; +91 98200 00000</p>
    </div>
  </div>
</body>
</html>`;
}

export class MailService {
  async sendReservationConfirmation(data: ReservationMailData): Promise<void> {
    try {
      const transporter = createTransporter();
      await transporter.sendMail({
        from: `"Elixir & Oak" <hello@elixirandoak.in>`,
        to: data.email,
        subject: `Reservation Confirmed — ${data.reservationCode} | Elixir & Oak`,
        html: confirmationTemplate(data),
      });
      logger.info(
        { to: data.email, code: data.reservationCode },
        'Reservation confirmation email sent.'
      );
    } catch (err) {
      // Silent fail — SMTP errors must never crash the server
      logger.error(
        { err, to: data.email },
        'Failed to send reservation confirmation email.'
      );
    }
  }

  async sendReservationCancellation(data: ReservationMailData): Promise<void> {
    try {
      const transporter = createTransporter();
      await transporter.sendMail({
        from: `"Elixir & Oak" <hello@elixirandoak.in>`,
        to: data.email,
        subject: `Reservation Cancelled — ${data.reservationCode} | Elixir & Oak`,
        html: cancellationTemplate(data),
      });
      logger.info(
        { to: data.email, code: data.reservationCode },
        'Reservation cancellation email sent.'
      );
    } catch (err) {
      logger.error(
        { err, to: data.email },
        'Failed to send reservation cancellation email.'
      );
    }
  }

  async sendContactNotificationToAdmin(contact: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<void> {
    try {
      const transporter = createTransporter();
      await transporter.sendMail({
        from: `"Elixir & Oak Contact Form" <hello@elixirandoak.in>`,
        to: 'admin@elixirandoak.in',
        subject: `New Customer Inquiry: ${contact.subject}`,
        text: `You have received a new customer inquiry from ${contact.name} (${contact.email}):\n\nSubject: ${contact.subject}\n\nMessage:\n${contact.message}`,
        html: `<p>You have received a new customer inquiry from <strong>${contact.name}</strong> (${contact.email}):</p><p><strong>Subject:</strong> ${contact.subject}</p><p><strong>Message:</strong><br/>${contact.message}</p>`,
      });
      logger.info({ email: contact.email }, 'Admin notification email sent.');
    } catch (err) {
      logger.error(
        { err, email: contact.email },
        'Failed to send admin contact notification email.'
      );
    }
  }

  async sendNewsletterWelcome(email: string): Promise<void> {
    try {
      const transporter = createTransporter();
      await transporter.sendMail({
        from: `"Elixir & Oak" <hello@elixirandoak.in>`,
        to: email,
        subject: 'Welcome to Elixir & Oak Newsletter!',
        text: 'Thank you for subscribing to our newsletter! We will keep you updated with the latest events and culinary creations.',
        html: '<h3>Welcome to the Elixir & Oak Newsletter!</h3><p>Thank you for subscribing to our newsletter! We will keep you updated with the latest events, culinary creations, and exclusive offers.</p>',
      });
      logger.info({ email }, 'Newsletter welcome email sent.');
    } catch (err) {
      logger.error({ err, email }, 'Failed to send newsletter welcome email.');
    }
  }

  async sendNewsletterUnsubscribe(email: string): Promise<void> {
    try {
      const transporter = createTransporter();
      await transporter.sendMail({
        from: `"Elixir & Oak" <hello@elixirandoak.in>`,
        to: email,
        subject: 'Newsletter Unsubscribed — Elixir & Oak',
        text: 'You have unsubscribed from our newsletter. We are sorry to see you go.',
        html: '<h3>Newsletter Unsubscribed</h3><p>You have successfully unsubscribed from our newsletter. We are sorry to see you go and hope to see you back soon.</p>',
      });
      logger.info({ email }, 'Newsletter unsubscribe email sent.');
    } catch (err) {
      logger.error({ err, email }, 'Failed to send newsletter unsubscribe email.');
    }
  }
}

export const mailService = new MailService();
