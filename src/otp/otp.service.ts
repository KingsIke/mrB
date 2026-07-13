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

  async generateAndSendOtp(user: User): Promise<void> {
    // Invalidate any existing unused OTPs for this user
    await this.otpRepository.update(
      { userId: user.id, isUsed: false },
      { isUsed: true },
    );

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryMinutes = this.configService.get<number>('OTP_EXPIRY_MINUTES', 10);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Save OTP to database
    const otp = this.otpRepository.create({
      code,
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      expiresAt,
      userId: user.id,
    });
    await this.otpRepository.save(otp);

    // Send email
    await this.sendOtpEmail(user.email, code, expiryMinutes);
  }

  async verifyOtp(userId: string, code: string): Promise<boolean> {
    const otp = await this.otpRepository.findOne({
      where: {
        userId,
        code,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!otp) {
      return false;
    }

    // Mark OTP as used
    otp.isUsed = true;
    await this.otpRepository.save(otp);

    return true;
  }

  async cleanupExpiredOtps(): Promise<void> {
    await this.otpRepository.delete({
      expiresAt: LessThan(new Date()),
    });
  }

  private async sendOtpEmail(email: string, code: string, expiryMinutes: number): Promise<void> {
    const from = this.configService.get('SMTP_FROM', 'noreply@schoolsocial.app');

    await this.transporter.sendMail({
      from: `"School Social" <${from}>`,
      to: email,
      subject: 'Verify Your Email - School Social',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Welcome to School Social!</h2>
          <p>Your verification code is:</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #333; border-radius: 8px; margin: 20px 0;">
            ${code}
          </div>
          <p>This code will expire in <strong>${expiryMinutes} minutes</strong>.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
      text: `Your School Social verification code is: ${code}. This code will expire in ${expiryMinutes} minutes.`,
    });
  }
}
