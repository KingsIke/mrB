import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { OtpCode, OtpPurpose } from './entities/otp.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class OtpService {
  private transporter: nodemailer.Transporter;

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