import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { OtpCode, OtpPurpose } from './entities/otp.entity';
import { User, UserStatus } from '../users/entities/user.entity';

@Injectable()
export class OtpService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectRepository(OtpCode)
    private readonly otpRepository: Repository<OtpCode>,
    private readonly configService: ConfigService,
  ) {
    const port = this.configService.get<number>('SMTP_PORT', 465);
    const secure = this.configService.get<boolean>('SMTP_SECURE', port === 465);

    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST', 'smtp.zoho.com'),
      port,
      secure, // true for 465 (SSL), false for 587 (STARTTLS)
      auth: {
        user: this.configService.get('SMTP_USER'), // Your Zoho email address (e.g., support@schoolsocial.app)
        pass: this.configService.get('SMTP_PASS'), // Zoho account password or Application-Specific Password
      },
    });
  }

  // ========== GENERATE & SEND OTP (WITH PURPOSE SUPPORT) ==========
  async generateAndSendOtp(
    user: User, 
    purpose: OtpPurpose = OtpPurpose.EMAIL_VERIFICATION
  ): Promise<void> {
    // Invalidate any existing unused OTPs of the SAME purpose for this user
    await this.otpRepository.update(
      { userId: user.id, purpose, isUsed: false },
      { isUsed: true },
    );

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryMinutes = this.configService.get<number>('OTP_EXPIRY_MINUTES', 10);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Save OTP to database with its specific purpose
    const otp = this.otpRepository.create({
      code,
      purpose,
      expiresAt,
      userId: user.id,
    });
    await this.otpRepository.save(otp);

    // Send the styled email depending on the purpose
    await this.sendOtpEmail(user.email, code, expiryMinutes, purpose);
  }

  // ========== REACTIVATION NOTIFICATION ==========
  async sendReactivationEmail(user: User): Promise<void> {
    const from = this.configService.get('SMTP_FROM', this.configService.get('SMTP_USER'));
    const displayName =
      `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'there';

    await this.transporter.sendMail({
      from: `"3NAMES" <${from}>`,
      to: user.email,
      subject: 'Your Account Has Been Reactivated - 3NAMES',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e9e9e9; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #333333; margin-top: 0;">Welcome back, ${displayName}! 👋</h2>
          <p style="color: #555555; font-size: 16px; line-height: 1.5;">
            Your <strong>3NAMES</strong> account has been reactivated and you are now logged in.
          </p>
          <p style="color: #555555; font-size: 16px; line-height: 1.5;">
            If you didn't reactivate your account, please secure it immediately by
            changing your password, and contact our support team.
          </p>
          <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 24px 0;" />
          <p style="color: #999999; font-size: 13px; line-height: 1.4;">
            This is an automated message — please do not reply to this email.
          </p>
        </div>
      `,
      text: `Welcome back, ${displayName}! Your 3NAMES account has been reactivated and you are now logged in. If you didn't reactivate your account, please change your password immediately.`,
    });
  } 

  // ========== ADMIN NOTIFICATION: NEW USER AWAITING VERIFICATION ==========
  /**
   * Notify the admin team (ADMIN_EMAILS) that a new user has completed
   * onboarding and submitted verification documents, so an admin can
   * review and verify the account. Best-effort — callers should catch
   * failures so onboarding is never blocked by email issues.
   */
  async notifyAdminsOfNewRegistration(user: User): Promise<void> {
    const adminEmails = this.configService
      .get<string>('ADMIN_EMAILS', '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    if (adminEmails.length === 0) {
      return; // No admins configured to notify
    }

    const from = this.configService.get('SMTP_FROM', this.configService.get('SMTP_USER'));
    const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'there';

    const details: Array<[string, string | null | undefined]> = [
      ['Name', displayName],
      ['Username', user.username],
      ['Email', user.email],
      ['Phone number', user.phoneNumber],
      ['School', (user as any).school?.name],
      ['Faculty', (user as any).faculty?.name],
      ['Department', (user as any).department?.name],
      ['Matric number', user.matricNumber],
      ['JAMB number', user.jambNumber],
    ];

    const detailRows = details
      .filter(([, value]) => value)
      .map(
        ([label, value]) =>
          `<tr><td style='padding:6px 12px;border:1px solid #eee;color:#666;'>${label}</td><td style='padding:6px 12px;border:1px solid #eee;color:#1a1a1a;'><strong>${value}</strong></td></tr>`,
      )
      .join('');

    const docLinks: string[] = [];
    if (user.schoolIdCardUrl) {
      docLinks.push(`<li><a href='${user.schoolIdCardUrl}' style='color:#007AFF;'>School ID Card</a></li>`);
    }
    if (user.administrationLetterUrl) {
      docLinks.push(`<li><a href='${user.administrationLetterUrl}' style='color:#007AFF;'>Admission / Administration Letter</a></li>`);
    }

    const textLines = [
      'A new user completed onboarding and is awaiting verification:',
      '',
      ...details.filter(([, v]) => v).map(([label, value]) => label + ': ' + value),
      '',
      'Submitted documents:',
      user.schoolIdCardUrl
        ? '- School ID Card: ' + user.schoolIdCardUrl
        : '- School ID Card: not uploaded',
      user.administrationLetterUrl
        ? '- Admission / Administration Letter: ' + user.administrationLetterUrl
        : '- Admission / Administration Letter: not uploaded',
      '',
      'Please log in to the admin dashboard to review and verify this user.',
    ];

    await this.transporter.sendMail({
      from: '3NAMES <' + from + '>',
      to: adminEmails.join(', '),
      subject: `New user awaiting verification: ${displayName}`,
      html: `
        <div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e9e9e9;border-radius:12px;background:#ffffff;'>
          <h2 style='color:#333333;margin-top:0;'>New user awaiting verification 🎓</h2>
          <p style='color:#555555;font-size:16px;line-height:1.5;'>
            <strong>${displayName}</strong> just completed onboarding and submitted
            verification documents. Review the details below, then verify the account.
          </p>
          <table style='width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;'>
            ${detailRows}
          </table>
          <div style='background:#f8f9fa;padding:16px;border-radius:8px;margin:16px 0;border:1px solid #eeeeee;'>
            <p style='margin:0 0 8px;color:#555555;font-size:14px;'><strong>Submitted documents:</strong></p>
            <ul style='margin:0;padding-left:20px;color:#555555;font-size:14px;'>${docLinks.join('')}</ul>
          </div>
          <hr style='border:0;border-top:1px solid #eeeeee;margin:24px 0;' />
          <p style='color:#999999;font-size:13px;line-height:1.4;'>
            This is an automated notification from 3NAMES. No action is needed if you have already verified this user.
          </p>
        </div>
      `,
      text: textLines.join('\n'),
    });
  }

  // ========== ADMIN NOTIFICATION: STUDENT UNION VERIFICATION REQUEST ==========
  /**
   * Notify the admin team (ADMIN_EMAILS) that a user submitted (or
   * resubmitted) a Student Union document, so an admin can review and
   * verify their membership. Best-effort — callers should catch failures.
   */
  async notifyAdminsOfStudentUnionSubmission(user: User): Promise<void> {
    const adminEmails = this.configService
      .get<string>('ADMIN_EMAILS', '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    if (adminEmails.length === 0) {
      return; // No admins configured to notify
    }

    const from = this.configService.get('SMTP_FROM', this.configService.get('SMTP_USER'));
    const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'there';

    const details: Array<[string, string | null | undefined]> = [
      ['Name', displayName],
      ['Username', user.username],
      ['Email', user.email],
      ['Phone number', user.phoneNumber],
      ['School', (user as any).school?.name],
      ['Faculty', (user as any).faculty?.name],
      ['Department', (user as any).department?.name],
    ];

    const detailRows = details
      .filter(([, value]) => value)
      .map(
        ([label, value]) =>
          `<tr><td style='padding:6px 12px;border:1px solid #eee;color:#666;'>${label}</td><td style='padding:6px 12px;border:1px solid #eee;color:#1a1a1a;'><strong>${value}</strong></td></tr>`,
      )
      .join('');

    const textLines = [
      'A user submitted a Student Union verification document:',
      '',
      ...details.filter(([, v]) => v).map(([label, value]) => label + ': ' + value),
      '',
      'Submitted document:',
      user.studentUnionDocUrl ? '- Student Union Document: ' + user.studentUnionDocUrl : '- Student Union Document: not uploaded',
      '',
      'Please log in to the admin dashboard to review and verify this user.',
    ];

    await this.transporter.sendMail({
      from: '3NAMES <' + from + '>',
      to: adminEmails.join(', '),
      subject: `Student Union verification request: ${displayName}`,
      html: `
        <div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e9e9e9;border-radius:12px;background:#ffffff;'>
          <h2 style='color:#333333;margin-top:0;'>Student Union verification request 🎓</h2>
          <p style='color:#555555;font-size:16px;line-height:1.5;'>
            <strong>${displayName}</strong> submitted a Student Union document for review.
            Review the details below, then verify their membership.
          </p>
          <table style='width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;'>
            ${detailRows}
          </table>
          <div style='background:#f8f9fa;padding:16px;border-radius:8px;margin:16px 0;border:1px solid #eeeeee;'>
            <p style='margin:0 0 8px;color:#555555;font-size:14px;'><strong>Submitted document:</strong></p>
            <p style='margin:0;color:#555555;font-size:14px;'>
              <a href='${user.studentUnionDocUrl}' style='color:#007AFF;'>View Student Union Document</a>
            </p>
          </div>
          <hr style='border:0;border-top:1px solid #eeeeee;margin:24px 0;' />
          <p style='color:#999999;font-size:13px;line-height:1.4;'>
            This is an automated notification from 3NAMES. No action is needed if you have already reviewed this document.
          </p>
        </div>
      `,
      text: textLines.join('\n'),
    });
  }

  // ========== ADMIN NOTIFICATION: VERIFICATION DOCUMENTS SUBMITTED ==========
  /**
   * Notify the admin team (ADMIN_EMAILS) that a user uploaded (or replaced)
   * student verification documents via the verification flow, so an admin
   * can review them. Best-effort — callers should catch failures.
   */
  async notifyAdminsOfVerificationDocuments(user: User): Promise<void> {
    const adminEmails = this.configService
      .get<string>('ADMIN_EMAILS', '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    if (adminEmails.length === 0) {
      return; // No admins configured to notify
    }

    const from = this.configService.get('SMTP_FROM', this.configService.get('SMTP_USER'));
    const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'there';

    const details: Array<[string, string | null | undefined]> = [
      ['Name', displayName],
      ['Username', user.username],
      ['Email', user.email],
      ['Phone number', user.phoneNumber],
      ['School', (user as any).school?.name],
      ['Faculty', (user as any).faculty?.name],
      ['Department', (user as any).department?.name],
      ['Matric number', user.matricNumber],
      ['JAMB number', user.jambNumber],
    ];

    const detailRows = details
      .filter(([, value]) => value)
      .map(
        ([label, value]) =>
          `<tr><td style='padding:6px 12px;border:1px solid #eee;color:#666;'>${label}</td><td style='padding:6px 12px;border:1px solid #eee;color:#1a1a1a;'><strong>${value}</strong></td></tr>`,
      )
      .join('');

    const docLinks: string[] = [];
    if (user.schoolIdCardUrl) {
      docLinks.push(`<li><a href='${user.schoolIdCardUrl}' style='color:#007AFF;'>School ID Card</a></li>`);
    }
    if (user.administrationLetterUrl) {
      docLinks.push(`<li><a href='${user.administrationLetterUrl}' style='color:#007AFF;'>Admission / Administration Letter</a></li>`);
    }

    const textLines = [
      'A user submitted verification documents for review:',
      '',
      ...details.filter(([, v]) => v).map(([label, value]) => label + ': ' + value),
      '',
      'Submitted documents:',
      user.schoolIdCardUrl ? '- School ID Card: ' + user.schoolIdCardUrl : '- School ID Card: not uploaded',
      user.administrationLetterUrl ? '- Admission / Administration Letter: ' + user.administrationLetterUrl : '- Admission / Administration Letter: not uploaded',
      '',
      'Please log in to the admin dashboard to review and verify this user.',
    ];

    await this.transporter.sendMail({
      from: '3NAMES <' + from + '>',
      to: adminEmails.join(', '),
      subject: `Verification documents submitted: ${displayName}`,
      html: `
        <div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e9e9e9;border-radius:12px;background:#ffffff;'>
          <h2 style='color:#333333;margin-top:0;'>New verification documents submitted 🎓</h2>
          <p style='color:#555555;font-size:16px;line-height:1.5;'>
            <strong>${displayName}</strong> submitted verification documents for review.
            Review the details below, then verify the account.
          </p>
          <table style='width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;'>
            ${detailRows}
          </table>
          <div style='background:#f8f9fa;padding:16px;border-radius:8px;margin:16px 0;border:1px solid #eeeeee;'>
            <p style='margin:0 0 8px;color:#555555;font-size:14px;'><strong>Submitted documents:</strong></p>
            <ul style='margin:0;padding-left:20px;color:#555555;font-size:14px;'>${docLinks.join('')}</ul>
          </div>
          <hr style='border:0;border-top:1px solid #eeeeee;margin:24px 0;' />
          <p style='color:#999999;font-size:13px;line-height:1.4;'>
            This is an automated notification from 3NAMES. No action is needed if you have already reviewed these documents.
          </p>
        </div>
      `,
      text: textLines.join('\n'),
    });
  }

  // ========== ADMIN NOTIFICATION: WITHDRAWAL REQUEST ==========
  /**
   * Notify the admin team (ADMIN_EMAILS) that a user requested a cash
   * withdrawal from their earned balance, so an admin can process the
   * payout. Best-effort — callers should catch failures.
   */
  async notifyAdminsOfWithdrawal(
    user: User,
    amountNgn: number,
    bankDetails: { bankCode: string; accountNumber: string },
    reference: string,
  ): Promise<void> {
    const adminEmails = this.configService
      .get<string>('ADMIN_EMAILS', '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    if (adminEmails.length === 0) {
      return; // No admins configured to notify
    }

    const from = this.configService.get('SMTP_FROM', this.configService.get('SMTP_USER'));
    const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'there';
    const formattedAmount = '₦' + amountNgn.toLocaleString();

    const details: Array<[string, string | null | undefined]> = [
      ['Name', displayName],
      ['Username', user.username],
      ['Email', user.email],
      ['Phone number', user.phoneNumber],
      ['School', (user as any).school?.name],
      ['Faculty', (user as any).faculty?.name],
      ['Department', (user as any).department?.name],
      ['Withdrawal amount', formattedAmount],
      ['Bank code', bankDetails.bankCode],
      ['Account number', bankDetails.accountNumber],
      ['Reference', reference],
    ];

    const detailRows = details
      .filter(([, value]) => value)
      .map(
        ([label, value]) =>
          `<tr><td style='padding:6px 12px;border:1px solid #eee;color:#666;'>${label}</td><td style='padding:6px 12px;border:1px solid #eee;color:#1a1a1a;'><strong>${value}</strong></td></tr>`,
      )
      .join('');

    const textLines = [
      'A user requested a cash withdrawal:',
      '',
      ...details.filter(([, v]) => v).map(([label, value]) => label + ': ' + value),
      '',
      'Please log in to the admin dashboard and process this payout.',
    ];

    await this.transporter.sendMail({
      from: '3NAMES <' + from + '>',
      to: adminEmails.join(', '),
      subject: `Withdrawal request: ${formattedAmount} (${displayName})`,
      html: `
        <div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e9e9e9;border-radius:12px;background:#ffffff;'>
          <h2 style='color:#333333;margin-top:0;'>Withdrawal request 🏦</h2>
          <p style='color:#555555;font-size:16px;line-height:1.5;'>
            <strong>${displayName}</strong> requested a cash withdrawal of <strong>${formattedAmount}</strong>.
            Payout details are below — please process the transfer to the account shown.
          </p>
          <table style='width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;'>
            ${detailRows}
          </table>
          <hr style='border:0;border-top:1px solid #eeeeee;margin:24px 0;' />
          <p style='color:#999999;font-size:13px;line-height:1.4;'>
            This is an automated notification from 3NAMES. Reference: ${reference}
          </p>
        </div>
      `,
      text: textLines.join('\n'),
    });
  }

  // ========== USER NOTIFICATION: WITHDRAWAL RECEIPT ==========
  /**
   * Send the user a confirmation receipt after they request a withdrawal.
   * Best-effort — callers should catch failures.
   */
  async notifyUserOfWithdrawal(user: User, amountNgn: number, reference: string): Promise<void> {
    if (!user.email) {
      return;
    }

    const from = this.configService.get('SMTP_FROM', this.configService.get('SMTP_USER'));
    const formattedAmount = '₦' + amountNgn.toLocaleString();
    const firstName = user.firstName || 'there';

    await this.transporter.sendMail({
      from: '3NAMES <' + from + '>',
      to: user.email,
      subject: 'Your withdrawal request has been received - 3NAMES',
      html: `
        <div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e9e9e9;border-radius:12px;background:#ffffff;'>
          <h2 style='color:#333333;margin-top:0;'>Withdrawal request received 💸</h2>
          <p style='color:#555555;font-size:16px;line-height:1.5;'>
            Hi ${firstName}, we have received your withdrawal request of <strong>${formattedAmount}</strong>.
            It is now being reviewed and will be paid out to your bank account shortly.
          </p>
          <div style='background:#f8f9fa;padding:16px;border-radius:8px;margin:16px 0;border:1px solid #eeeeee;'>
            <p style='margin:0;color:#555555;font-size:14px;'>
              Reference: <strong style='color:#1a1a1a;'>${reference}</strong>
            </p>
          </div>
          <hr style='border:0;border-top:1px solid #eeeeee;margin:24px 0;' />
          <p style='color:#999999;font-size:13px;line-height:1.4;'>
            If you did not request this withdrawal, please contact our support team immediately.
          </p>
        </div>
      `,
      text:
        'Hi ' +
        firstName +
        ', we have received your withdrawal request of ' +
        formattedAmount +
        '. It is now being reviewed and will be paid out to your bank account shortly.\n\nReference: ' +
        reference +
        '\n\nIf you did not request this withdrawal, please contact our support team immediately.',
    });
  }

  // ========== MODERATION & VERIFICATION DECISION EMAILS ==========
  /**
   * Every approve/reject decision email has the same shape — what was
   * decided, the reason (when the admin gave one) and what happens next —
   * so the helpers below all funnel through here.
   *
   * Best-effort: callers should catch failures so an email problem never
   * fails an admin's decision, which is already persisted by then.
   */
  private async sendDecisionEmail(params: {
    user: User | null | undefined;
    subject: string;
    heading: string;
    intro: string;
    reason?: string;
    nextSteps: string;
  }): Promise<void> {
    const { user, subject, heading, intro, reason, nextSteps } = params;
    if (!user?.email) {
      this.logger.warn(
        `Skipping decision email ("${subject}"): user ${user?.id ?? 'unknown'} has no email address`,
      );
      return; // Nothing to send to
    }

    const from = this.configService.get('SMTP_FROM', this.configService.get('SMTP_USER'));
    const firstName = user.firstName || 'there';
    const safeIntro = this.escapeHtml(intro);
    const safeReason = reason ? this.escapeHtml(reason) : undefined;

    const reasonBlock = safeReason
      ? `
          <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin:16px 0;border:1px solid #eeeeee;">
            <p style="margin:0 0 6px;color:#555555;font-size:14px;"><strong>Reason</strong></p>
            <p style="margin:0;color:#1a1a1a;font-size:14px;">${safeReason}</p>
          </div>`
      : '';

    try {
      await this.transporter.sendMail({
        from: `"3NAMES" <${from}>`,
        to: user.email,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e9e9e9; border-radius: 12px; background: #ffffff;">
            <h2 style="color: #333333; margin-top: 0;">${heading}</h2>
            <p style="color: #555555; font-size: 16px; line-height: 1.5;">Hi ${firstName}, ${safeIntro}</p>
            ${reasonBlock}
            <p style="color: #555555; font-size: 15px; line-height: 1.5;">${nextSteps}</p>
            <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 24px 0;" />
            <p style="color: #999999; font-size: 13px; line-height: 1.4;">
              This is an automated message from 3NAMES — please do not reply to this email.
            </p>
          </div>
        `,
        text:
          `Hi ${firstName}, ${intro}` +
          (reason ? ` Reason: ${reason}` : '') +
          ` ${nextSteps}`,
      });
      this.logger.log(`Decision email sent to ${user.email} ("${subject}")`);
    } catch (err) {
      // Surface the real reason (bad SMTP credentials, blocked host, ...) in
      // the logs; callers still swallow it so the persisted decision stands.
      this.logger.error(
        `Failed to send decision email to ${user.email} ("${subject}"): ` +
          (err instanceof Error ? err.message : String(err)),
      );
      throw err;
    }
  }

  /** Escapes user/listing-provided text before it's interpolated into email HTML. */
  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ========== USER NOTIFICATION: MARKETPLACE LISTING DECISION ==========
  /**
   * Tell a seller whether their marketplace listing was approved or
   * rejected. Rejections carry the admin's reason so the seller knows what
   * to fix before resubmitting.
   */
  async notifyUserOfMarketplaceItemDecision(
    user: User | null | undefined,
    itemTitle: string | null | undefined,
    approved: boolean,
    reason?: string,
  ): Promise<void> {
    const listing = itemTitle ? `"${itemTitle}"` : 'your listing';

    await this.sendDecisionEmail({
      user,
      subject: approved
        ? 'Your marketplace listing was approved - 3NAMES'
        : 'Your marketplace listing was not approved - 3NAMES',
      heading: approved ? 'Listing approved ✅' : 'Listing not approved',
      intro: approved
        ? `your marketplace listing ${listing} was approved and is now live for your schoolmates to see.`
        : `your marketplace listing ${listing} was reviewed and could not be approved, so it isn't visible to anyone else.`,
      reason,
      nextSteps: approved
        ? 'You can edit, close or delete the listing any time from the Marketplace tab in the app.'
        : 'You can update the listing and resubmit it for review from the Marketplace tab in the app.',
    });
  }

  // ========== USER NOTIFICATION: HOSTEL LISTING DECISION ==========
  /**
   * Tell a lister whether their hostel listing was approved or rejected,
   * including the admin's reason when it was rejected.
   */
  async notifyUserOfHostelListingDecision(
    user: User | null | undefined,
    hostelName: string | null | undefined,
    approved: boolean,
    reason?: string,
  ): Promise<void> {
    const listing = hostelName ? `"${hostelName}"` : 'your hostel listing';

    await this.sendDecisionEmail({
      user,
      subject: approved
        ? 'Your hostel listing was approved - 3NAMES'
        : 'Your hostel listing was not approved - 3NAMES',
      heading: approved ? 'Hostel listing approved ✅' : 'Hostel listing not approved',
      intro: approved
        ? `your hostel listing ${listing} was approved and is now live for your schoolmates to see.`
        : `your hostel listing ${listing} was reviewed and could not be approved, so it isn't visible to anyone else.`,
      reason,
      nextSteps: approved
        ? 'You can mark it as taken or update the details any time from the Hostels tab in the app.'
        : 'You can update the listing and resubmit it for review from the Hostels tab in the app.',
    });
  }

  // ========== USER NOTIFICATION: STUDENT VERIFICATION DECISION ==========
  /**
   * Tell a student whether the admin team approved or rejected their
   * student verification documents.
   */
  async notifyUserOfVerificationDecision(
    user: User | null | undefined,
    approved: boolean,
    reason?: string,
  ): Promise<void> {
    const deadline = user?.verificationGraceExpiresAt
      ? new Date(user.verificationGraceExpiresAt).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

    await this.sendDecisionEmail({
      user,
      subject: approved
        ? 'Your student verification was approved - 3NAMES'
        : 'Your student verification was not approved - 3NAMES',
      heading: approved
        ? 'Student verification approved ✅'
        : 'Student verification not approved',
      intro: approved
        ? 'your student identity has been verified — your verified badge is now active on your profile.'
        : "we reviewed your student verification documents and couldn't approve them.",
      reason,
      nextSteps: approved
        ? 'Your verified badge lets schoolmates know your posts and listings come from a real student.'
        : 'Please review what you uploaded and resubmit clear, valid proof of your student status in the app.' +
          (deadline
            ? ` You have until ${deadline} to resubmit — after that, your account will be automatically restricted (limited to browsing, messaging, and purchases) until you do.`
            : ''),
    });
  }

  // ========== USER NOTIFICATION: STUDENT UNION DECISION ==========
  /**
   * Tell a student whether the admin team approved or rejected their
   * Student Union proof document. Approval unlocks campus event creation.
   */
  async notifyUserOfStudentUnionDecision(
    user: User | null | undefined,
    approved: boolean,
    reason?: string,
  ): Promise<void> {
    await this.sendDecisionEmail({
      user,
      subject: approved
        ? 'Your Student Union verification was approved - 3NAMES'
        : 'Your Student Union verification was not approved - 3NAMES',
      heading: approved ? 'Student Union verified ✅' : 'Student Union not approved',
      intro: approved
        ? 'your Student Union membership has been confirmed — you can now create campus events.'
        : "we reviewed your Student Union document and couldn't approve it.",
      reason,
      nextSteps: approved
        ? 'Head to the Events tab in the app to create your first campus event.'
        : 'Please resubmit a valid Student Union document in the app so we can review it again.',
    });
  }

  // ========== USER NOTIFICATION: ACCOUNT STATUS CHANGE ==========
  /**
   * Tell a student their account was restricted, suspended, or banned by an
   * admin (or reactivated out of one of those states). Best-effort — callers
   * catch failures so the persisted status change is never blocked by email.
   */
  async notifyUserOfAccountStatusChange(
    user: User | null | undefined,
    status: UserStatus,
    reason?: string,
  ): Promise<void> {
    const from = this.configService.get('CONTACT_MAIL', this.configService.get('CONTACT_MAIL'));

    const copy: Record<
      'restricted' | 'suspended' | 'banned' | 'active',
      { subject: string; heading: string; intro: string; nextSteps: string }
    > = {
      restricted: {
        subject: 'Your account has been restricted - 3NAMES',
        heading: 'Account restricted',
        intro: 'your account has been placed on restricted access.',
        nextSteps:
          "You can still browse, comment, message, and buy as normal, but you won't be able to create new posts, marketplace/hostel listings, or send gifts until this is lifted. " +
          'If you think this is a mistake, use "Report a Problem" in the app to reach our support team.',
      },
      suspended: {
        subject: 'Your account has been suspended - 3NAMES',
        heading: 'Account suspended',
        intro: 'your account has been suspended.',
        nextSteps:
          'You can still sign in to view your profile and manage your account, but posting, messaging, and marketplace activity are on hold until this is resolved. ' +
          'If you think this is a mistake, use "Report a Problem" in the app to reach our support team.',
      },
      banned: {
        subject: 'Your account has been banned - 3NAMES',
        heading: 'Account banned',
        intro: 'your account has been banned from 3NAMES.',
        nextSteps:
          `You will no longer be able to sign in. If you believe this was done in error, contact us at ${from} and we'll take a look.`,
      },
      active: {
        subject: 'Your account is active again - 3NAMES',
        heading: 'Account reactivated ✅',
        intro: 'your account has been reactivated and is back to full access.',
        nextSteps: 'You can now use 3NAMES as normal. Welcome back!',
      },
    };

    const entry = copy[status as keyof typeof copy];
    if (!entry) return; // Not a moderation status change — nothing to email

    await this.sendDecisionEmail({
      user,
      subject: entry.subject,
      heading: entry.heading,
      intro: entry.intro,
      reason,
      nextSteps: entry.nextSteps,
    });
  }

  // ========== VERIFY OTP (WITH PURPOSE SECURITY) ==========
  async verifyOtp(
    userId: string, 
    code: string, 
    purpose?: OtpPurpose
  ): Promise<boolean> {
    const queryCondition: any = {
      userId,
      code,
      isUsed: false,
      expiresAt: MoreThan(new Date()),
    };

    // If a purpose is provided, strictly enforce it so that verification OTPs 
    // cannot be maliciously reused to reset passwords.
    if (purpose) {
      queryCondition.purpose = purpose;
    }

    const otp = await this.otpRepository.findOne({
      where: queryCondition,
    });

    if (!otp) {
      return false;
    }

    // Mark OTP as used
    otp.isUsed = true;
    await this.otpRepository.save(otp);

    return true;
  }

  // ========== CLEANUP ==========
  async cleanupExpiredOtps(): Promise<void> {
    await this.otpRepository.delete({
      expiresAt: LessThan(new Date()),
    });
  }

  // ========== PRIVATE: EMAIL DISPATCH ==========
  private async sendOtpEmail(
    email: string, 
    code: string, 
    expiryMinutes: number, 
    purpose: OtpPurpose
  ): Promise<void> {
    const from = this.configService.get('SMTP_FROM', this.configService.get('SMTP_USER'));
    
    // Customize email content based on purpose
    let subject = 'Verify Your Email - 3NAMES';
    let heading = 'Welcome to 3NAMES!';
    let bodyText = 'Your email verification code is:';
    let footerText = 'Thank you for registering. If you didn\'t request this code, please ignore this email.';

    if (purpose === OtpPurpose.PASSWORD_RESET) {
      subject = 'Reset Your Password - 3NAMES';
      heading = 'Password Reset Request';
      bodyText = 'We received a request to reset your password. Use the verification code below to proceed:';
      footerText = 'This is a secure action. If you did not request a password reset, please change your credentials immediately.';
    }

    if (purpose === OtpPurpose.ACCOUNT_REACTIVATION) {
      subject = 'Reactivate Your Account - 3NAMES';
      heading = 'Reactivate Your Account';
      bodyText = 'Use the verification code below to reactivate your account:';
      footerText = 'If you did not request to reactivate your account, please ignore this email and secure your account.';
    }

    if (purpose === OtpPurpose.TWO_FACTOR_AUTH) {
      subject = 'Your Login Code - 3NAMES';
      heading = 'Two-Factor Authentication';
      bodyText = 'Use the verification code below to finish signing in:';
      footerText = "If you didn't try to sign in, someone may have your password — change it immediately and secure your account.";
    }

    await this.transporter.sendMail({
      from: `"3NAMES" <${from}>`,
      to: email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e9e9e9; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #333333; margin-top: 0;">${heading}</h2>
          <p style="color: #555555; font-size: 16px; line-height: 1.5;">${bodyText}</p>
          <div style="background: #f8f9fa; padding: 24px; text-align: center; font-size: 36px; letter-spacing: 6px; font-weight: bold; color: #1a1a1a; border-radius: 8px; margin: 24px 0; border: 1px dashed #cccccc;">
            ${code}
          </div>
          <p style="color: #555555; font-size: 15px;">This code will expire in <strong style="color: #d9534f;">${expiryMinutes} minutes</strong>.</p>
          <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 24px 0;" />
          <p style="color: #999999; font-size: 13px; line-height: 1.4;">${footerText}</p>
        </div>
      `,
      text: `${bodyText} ${code}. This code will expire in ${expiryMinutes} minutes.`,
    });
  }
}