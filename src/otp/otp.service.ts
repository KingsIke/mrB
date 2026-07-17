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
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
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
    const from = this.configService.get('SMTP_FROM', 'noreply@schoolsocial.app');
    
    // Customize email content based on purpose
    let subject = 'Verify Your Email - School Social';
    let heading = 'Welcome to School Social!';
    let bodyText = 'Your email verification code is:';
    let footerText = 'Thank you for registering. If you didn\'t request this code, please ignore this email.';

    if (purpose === OtpPurpose.PASSWORD_RESET) {
      subject = 'Reset Your Password - School Social';
      heading = 'Password Reset Request';
      bodyText = 'We received a request to reset your password. Use the verification code below to proceed:';
      footerText = 'This is a secure action. If you did not request a password reset, please change your credentials immediately.';
    }

    await this.transporter.sendMail({
      from: `"School Social" <${from}>`,
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