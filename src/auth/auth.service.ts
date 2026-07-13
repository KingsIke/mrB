import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { OtpService } from '../otp/otp.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from '../users/dto/login.dto';
import { VerifyOtpDto } from '../users/dto/verify-otp.dto';
import { ResendOtpDto } from '../users/dto/resend-otp.dto';
import {
  OnboardingStep1Dto,
  OnboardingStep2Dto,
  OnboardingStep3Dto,
  CompleteOnboardingDto,
} from '../users/dto/onboarding.dto';
import { User, UserStatus, OnboardingStep } from '../users/entities/user.entity';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: Partial<User>;
  onboardingRequired: boolean;
  onboardingStep: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ========== SIGN UP ==========
  async signUp(createUserDto: CreateUserDto): Promise<{ message: string; email: string }> {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 12);

    // Create user with pending verification status
    const user = await this.usersService.create({
      ...createUserDto,
      password: hashedPassword,
      status: UserStatus.PENDING_VERIFICATION,
      onboardingStep: OnboardingStep.NONE,
    });

    // Generate and send OTP
    await this.otpService.generateAndSendOtp(user);

    return {
      message: 'Account created successfully. Please verify your email with the OTP sent.',
      email: user.email,
    };
  }

  // ========== VERIFY OTP ==========
  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<{ message: string; email: string }> {
    const user = await this.usersService.findByEmail(verifyOtpDto.email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValid = await this.otpService.verifyOtp(user.id, verifyOtpDto.code);
    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP code');
    }

    // Mark email as verified and update status
    await this.usersService.update(user.id, {
      isEmailVerified: true,
      status: UserStatus.PENDING_ONBOARDING,
      onboardingStep: OnboardingStep.EMAIL_VERIFIED,
    });

    return {
      message: 'Email verified successfully. Please complete your profile setup.',
      email: user.email,
    };
  }

  // ========== RESEND OTP ==========
  async resendOtp(resendOtpDto: ResendOtpDto): Promise<{ message: string; email: string }> {
    const user = await this.usersService.findByEmail(resendOtpDto.email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    await this.otpService.generateAndSendOtp(user);

    return {
      message: 'A new OTP has been sent to your email.',
      email: user.email,
    };
  }

  // ========== LOGIN ==========
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    // Check onboarding status
    const onboardingRequired = !user.isOnboardingComplete;
    const onboardingStep = user.onboardingStep;

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Update status if onboarding is complete
    if (user.isOnboardingComplete && user.status !== UserStatus.ACTIVE) {
      await this.usersService.update(user.id, { status: UserStatus.ACTIVE });
    }

    const { password, ...userWithoutPassword } = user;

    return {
      ...tokens,
      user: userWithoutPassword,
      onboardingRequired,
      onboardingStep,
    };
  }

  // ========== ONBOARDING ==========
  async completeOnboarding(
    userId: string,
    dto: CompleteOnboardingDto,
    files?: { profilePicture?: Express.Multer.File; schoolIdCard?: Express.Multer.File },
  ): Promise<{ message: string; user: Partial<User> }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isOnboardingComplete) {
      throw new BadRequestException('Onboarding is already complete');
    }

    // Check username uniqueness
    const existingUsername = await this.usersService.findByUsername(dto.username);
    if (existingUsername && existingUsername.id !== userId) {
      throw new ConflictException('Username is already taken');
    }

    if (!dto.termsAccepted) {
      throw new BadRequestException('You must accept the terms and conditions');
    }

    // Handle file uploads
    let profilePictureUrl = user.profilePictureUrl;
    let schoolIdCardUrl = user.schoolIdCardUrl;

    if (files?.profilePicture) {
      const result = await this.cloudinaryService.uploadFile(files.profilePicture, {
        folder: 'school-social/profile-pictures',
        resourceType: 'image',
      });
      profilePictureUrl = result.secure_url;
    }
    if (files?.schoolIdCard) {
      const result = await this.cloudinaryService.uploadFile(files.schoolIdCard, {
        folder: 'school-social/school-id-cards',
        resourceType: 'image',
      });
      schoolIdCardUrl = result.secure_url;
    }

    // Update user with all onboarding data
    const updatedUser = await this.usersService.update(userId, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: new Date(dto.dateOfBirth),
      gender: dto.gender,
      schoolId: dto.schoolId,
      faculty: dto.faculty,
      department: dto.department,
      matricNumber: dto.matricNumber || undefined,
      jambNumber: dto.jambNumber || undefined,
      username: dto.username,
      phoneNumber: dto.phoneNumber,
      profilePictureUrl,
      schoolIdCardUrl,
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      status: UserStatus.ACTIVE,
      onboardingStep: OnboardingStep.COMPLETED,
      isOnboardingComplete: true,
    });

    const { password, ...userWithoutPassword } = updatedUser;

    return {
      message: 'Onboarding completed successfully! Welcome to School Social.',
      user: userWithoutPassword,
    };
  }

  // ========== REFRESH TOKEN ==========
  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user || user.status === UserStatus.SUSPENDED) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  // ========== CHECK ONBOARDING STATUS ==========
  async checkOnboardingStatus(userId: string): Promise<{
    isComplete: boolean;
    step: string;
    missingFields: string[];
  }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const missingFields: string[] = [];

    if (!user.firstName || !user.lastName) missingFields.push('firstName', 'lastName');
    if (!user.dateOfBirth) missingFields.push('dateOfBirth');
    if (!user.gender) missingFields.push('gender');
    if (!user.schoolId) missingFields.push('school');
    if (!user.faculty) missingFields.push('faculty');
    if (!user.department) missingFields.push('department');
    if (!user.username) missingFields.push('username');
    if (!user.phoneNumber) missingFields.push('phoneNumber');
    if (!user.termsAccepted) missingFields.push('termsAccepted');
    if (!user.profilePictureUrl) missingFields.push('profilePicture');
    if (!user.schoolIdCardUrl) missingFields.push('schoolIdCard');
    if (!user.matricNumber && !user.jambNumber) missingFields.push('matricNumber or jambNumber');

    return {
      isComplete: user.isOnboardingComplete,
      step: user.onboardingStep,
      missingFields,
    };
  }

  // ========== PRIVATE: Generate Tokens ==========
  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: user.id, email: user.email, username: user.username };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
    });

    return { accessToken, refreshToken };
  }
}
