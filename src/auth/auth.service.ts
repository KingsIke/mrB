import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import axios from "axios";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { UsersService } from "../users/users.service";
import { OtpService } from "../otp/otp.service";
import { CloudinaryService } from "../cloudinary/cloudinary.service";
import { FacultiesService } from "../faculties/faculties.service";
import { DepartmentsService } from "../departments/departments.service";
import { CreateUserDto } from "../users/dto/create-user.dto";
import { LoginDto } from "../users/dto/login.dto";
import { ReactivateAccountDto } from "../users/dto/reactivate-account.dto";
import { VerifyOtpDto } from "../users/dto/verify-otp.dto";
import { Verify2faDto } from "../users/dto/verify-2fa.dto";
import { ResendOtpDto } from "../users/dto/resend-otp.dto";
import {
  OnboardingStep1Dto,
  OnboardingStep2Dto,
  OnboardingStep3Dto,
  CompleteOnboardingDto,
  ForgotPasswordDto,
  VerifyResetOtpDto,
  ResetPasswordWithTokenDto,
} from "../users/dto/onboarding.dto";
import { ChangePasswordDto } from "../users/dto/change-password.dto";
import { AccountActionDto } from "../users/dto/account-action.dto";
import {
  User,
  UserStatus,
  OnboardingStep,
} from "../users/entities/user.entity";
import { OtpPurpose } from "src/otp/entities/otp.entity";
import { GamificationService } from '../gamification/gamification.service';
import { SchoolsService } from "src/schools/schools.service";
import { GroupsService } from "../groups/groups.service";

export interface VerifyOtpResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  user: Partial<User> & {
    schoolName?: string;
    facultyName?: string;
    departmentName?: string;
    appLevel?: any;
    gamification?: {
      totalXp: number;
      nextLevel: any;
      progress: number;
      currentStreak: number;
    };
  };
  onboardingRequired: boolean;
  onboardingStep: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: Partial<User> & {
    schoolName?: string;
    facultyName?: string;
    departmentName?: string;
    appLevel?: any; 
    gamification?: {
      totalXp: number;
      nextLevel: any;
      progress: number;
      currentStreak: number;
    };
  };
  onboardingRequired: boolean;
  onboardingStep: string;
}

export interface TwoFactorRequiredInfo {
  twoFactorRequired: true;
  email: string;
  userId: string;
}

export interface DeactivatedAccountInfo {
  accountDeactivated: true;
  user: {
    id: string;
    email: string;
    username?: string;
    firstName: string;
    lastName: string;
    profilePictureUrl?: string | null;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly facultiesService: FacultiesService,
    private readonly departmentsService: DepartmentsService,
    private readonly schoolsService: SchoolsService,
    private readonly gamificationService: GamificationService,
    private readonly groupsService: GroupsService,
  ) {}

  // Helper function to extract School, Faculty, and Department details safely
  private async getUserAcademicDetails(user: User): Promise<{
    schoolName?: string;
    facultyName?: string;
    departmentName?: string;
  }> {
    let schoolName: string | undefined;
    let facultyName: string | undefined;
    let departmentName: string | undefined;

    // Check if relations are populated directly on the user entity
    if ((user as any).school?.name) {
      schoolName = (user as any).school.name;
    } else if (user.schoolId) {
      const school = await this.schoolsService.findById(user.schoolId);
      schoolName = school?.name;
    }

    if ((user as any).faculty?.name) {
      facultyName = (user as any).faculty.name;
    } else if (user.facultyId) {
      const faculty = await this.facultiesService.findById(user.facultyId);
      facultyName = faculty?.name;
      // Also grab school from faculty relation if not already found
      if (!schoolName && (faculty as any)?.school?.name) {
        schoolName = (faculty as any).school.name;
      }
    }

    if ((user as any).department?.name) {
      departmentName = (user as any).department.name;
    } else if (user.departmentId) {
      const department = await this.departmentsService.findById(user.departmentId);
      departmentName = department?.name;
    }

    return {
      schoolName,
      facultyName,
      departmentName,
    };
  }

  // ========== SIGN UP ==========
 async signUp(createUserDto: CreateUserDto): Promise<{ message: string; email: string }> {
  const existingUser = await this.usersService.findByEmail(createUserDto.email);
  if (existingUser) {
    throw new ConflictException("An account with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(createUserDto.password, 12);

  const user = await this.usersService.create({
    ...createUserDto,
    password: hashedPassword,
    status: UserStatus.PENDING_VERIFICATION,
    onboardingStep: OnboardingStep.NONE,
  });

  try {
    await this.otpService.generateAndSendOtp(user);
  } catch (error) {
    // Clean up the created user if OTP sending fails
    await this.usersService.remove(user.id);
    
    throw new InternalServerErrorException(
      "Failed to send verification email. Please try signing up again."
    );
  }

  return {
    message: "Account created successfully. Please verify your email with the OTP sent.",
    email: user.email,
  };
}
  // ========== VERIFY OTP (AUTO-LOGIN VERSION) ==========
  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<VerifyOtpResponse> {
    const user = await this.usersService.findByEmail(verifyOtpDto.email);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const isValid = await this.otpService.verifyOtp(user.id, verifyOtpDto.code);
    if (!isValid) {
      throw new BadRequestException("Invalid or expired OTP code");
    }

    const updatedUser = await this.usersService.update(user.id, {
      isEmailVerified: true,
      status: UserStatus.PENDING_ONBOARDING,
      onboardingStep: OnboardingStep.EMAIL_VERIFIED,
    });

    const tokens = await this.generateTokens(updatedUser);

    const onboardingRequired = !updatedUser.isOnboardingComplete;
    const onboardingStep = updatedUser.onboardingStep;

    await this.gamificationService.recordDailyLogin(updatedUser.id);
    const levelStats = await this.gamificationService.getMe(updatedUser.id);

    // Fetch school, faculty, and department names
    const academicDetails = await this.getUserAcademicDetails(updatedUser);

    const { password, ...userWithoutPassword } = updatedUser;

    return {
      message: "Email verified successfully. Welcome!",
      ...tokens,
      user: {
        ...userWithoutPassword,
        ...academicDetails,
        appLevel: levelStats.level,
        gamification: {
          totalXp: levelStats.totalXp,
          nextLevel: levelStats.nextLevel,
          progress: levelStats.progress,
          currentStreak: levelStats.currentStreak,
        },
      },
      onboardingRequired,
      onboardingStep,
    };
  }

  // ========== RESEND OTP ==========
  async resendOtp(
    resendOtpDto: ResendOtpDto,
  ): Promise<{ message: string; email: string }> {
    const user = await this.usersService.findByEmail(resendOtpDto.email);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.isEmailVerified) {
      throw new BadRequestException("Email is already verified");
    }

    await this.otpService.generateAndSendOtp(user);

    return {
      message: "A new OTP has been sent to your email.",
      email: user.email,
    };
  }

  // ========== LOGIN ==========
  async login(
    loginDto: LoginDto,
  ): Promise<AuthResponse | DeactivatedAccountInfo | TwoFactorRequiredInfo> {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password ?? '',
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.deletedAt) {
      throw new UnauthorizedException(
        "This account has been deleted and can no longer be used.",
      );
    }

    if (!user.isEmailVerified) {
      await this.otpService.generateAndSendOtp(user);
      throw new UnauthorizedException(
        "Please verify your email before logging in. A new OTP has been sent to your email.",
      );
    }

    // Account is deactivated (temporary) — don't log in silently. Return a
    // signal so the client can show an "Activate Account" flow instead.
    if (user.deactivatedAt) {
      return {
        accountDeactivated: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          profilePictureUrl: user.profilePictureUrl,
        },
      } as DeactivatedAccountInfo;
    }

    // Two-factor authentication is enabled — require the emailed code
    // before issuing tokens.
    if (user.twoFactorEnabled) {
      await this.otpService.generateAndSendOtp(user, OtpPurpose.TWO_FACTOR_AUTH);
      return {
        twoFactorRequired: true,
        email: user.email,
        userId: user.id,
      };
    }

    return this.buildAuthResponse(user);
  }

  /**
   * Complete a 2FA-protected login by verifying the emailed code, then
   * issue the normal auth response (tokens + user).
   */
  async verify2faLogin(verify2faDto: Verify2faDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(verify2faDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or code');
    }
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled for this account');
    }

    const isValid = await this.otpService.verifyOtp(
      user.id,
      verify2faDto.code,
      OtpPurpose.TWO_FACTOR_AUTH,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    if (user.isOnboardingComplete && user.status !== UserStatus.ACTIVE) {
      await this.usersService.update(user.id, { status: UserStatus.ACTIVE });
    }

    return this.buildAuthResponse(user);
  }

  /**
   * Resend the 2FA login code to the user's email (used on the login screen).
   */
  async resend2faLoginOtp(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled for this account');
    }
    await this.otpService.generateAndSendOtp(user, OtpPurpose.TWO_FACTOR_AUTH);
    return { message: 'A new verification code has been sent to your email.' };
  }

  /**
   * Enable two-factor authentication: send the setup code to the user's email.
   */
  async send2faSetupOtp(userId: string): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }
    await this.otpService.generateAndSendOtp(user, OtpPurpose.TWO_FACTOR_AUTH);
    return { message: 'A verification code has been sent to your email.' };
  }

  /**
   * Confirm setup by verifying the emailed code, then flip 2FA on.
   */
  async enable2fa(userId: string, code: string): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const isValid = await this.otpService.verifyOtp(
      user.id,
      code,
      OtpPurpose.TWO_FACTOR_AUTH,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }
    user.twoFactorEnabled = true;
    await this.usersService.update(user.id, { twoFactorEnabled: true });
    return { message: 'Two-factor authentication enabled successfully.' };
  }

  /**
   * Disable two-factor authentication (verified via a fresh emailed code).
   */
  async send2faDisableOtp(userId: string): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }
    await this.otpService.generateAndSendOtp(user, OtpPurpose.TWO_FACTOR_AUTH);
    return { message: 'A verification code has been sent to your email.' };
  }

  async disable2fa(userId: string, code: string): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const isValid = await this.otpService.verifyOtp(
      user.id,
      code,
      OtpPurpose.TWO_FACTOR_AUTH,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }
    await this.usersService.update(user.id, { twoFactorEnabled: false });
    return { message: 'Two-factor authentication disabled.' };
  }

  /**
   * Shared response builder: tokens + user + onboarding flags.
   */
  private async buildAuthResponse(user: User): Promise<AuthResponse> {
    const onboardingRequired = !user.isOnboardingComplete;
    const onboardingStep = user.onboardingStep;

    const tokens = await this.generateTokens(user);

    if (user.isOnboardingComplete && user.status !== UserStatus.ACTIVE) {
      await this.usersService.update(user.id, { status: UserStatus.ACTIVE });
    }

    await this.gamificationService.recordDailyLogin(user.id);
    const levelStats = await this.gamificationService.getMe(user.id);

    // Fetch school, faculty, and department names
    const academicDetails = await this.getUserAcademicDetails(user);

    const { password, ...userWithoutPassword } = user;

    return {
      ...tokens,
      user: {
        ...userWithoutPassword,
        ...academicDetails,
        appLevel: levelStats.level,
        gamification: {
          totalXp: levelStats.totalXp,
          nextLevel: levelStats.nextLevel,
          progress: levelStats.progress,
          currentStreak: levelStats.currentStreak,
        },
      },
      onboardingRequired,
      onboardingStep,
    };
  }

  // ========== ONBOARDING ==========
  async completeOnboarding(
    userId: string,
    dto: CompleteOnboardingDto,
    files?: {
      profilePicture?: Express.Multer.File;
      schoolIdCard?: Express.Multer.File;
      administrationLetter?: Express.Multer.File;
    },
  ): Promise<{ message: string; user: Partial<User> }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const existingPhone = await this.usersService.findByPhoneNumber(
      dto.phoneNumber,
    );
    if (existingPhone && existingPhone.id !== userId) {
      throw new ConflictException(
        "Phone number is already registered to another account",
      );
    }

    if (user.isOnboardingComplete) {
      throw new BadRequestException("Onboarding is already complete");
    }

    const existingUsername = await this.usersService.findByUsername(
      dto.username,
    );
    if (existingUsername && existingUsername.id !== userId) {
      throw new ConflictException("Username is already taken");
    }

    if (!dto.termsAccepted) {
      throw new BadRequestException("You must accept the terms and conditions");
    }

    const faculty = await this.facultiesService.findById(dto.facultyId);
    if (!faculty || faculty.schoolId !== dto.schoolId) {
      throw new NotFoundException("Faculty not found for the selected school");
    }

    const department = await this.departmentsService.findById(dto.departmentId);
    if (!department || department.facultyId !== dto.facultyId) {
      throw new NotFoundException(
        "Department not found for the selected faculty",
      );
    }

    let profilePictureUrl = user.profilePictureUrl;
    let schoolIdCardUrl = user.schoolIdCardUrl;
    let administrationLetterUrl = user.administrationLetterUrl;

    if (files?.profilePicture) {
      const result = await this.cloudinaryService.uploadFile(
        files.profilePicture,
        {
          folder: "school-social/profile-pictures",
          resourceType: "image",
        },
      );
      profilePictureUrl = result.secure_url;
    }
    if (files?.schoolIdCard) {
      const result = await this.cloudinaryService.uploadFile(
        files.schoolIdCard,
        {
          folder: "school-social/school-id-cards",
          resourceType: "image",
        },
      );
      schoolIdCardUrl = result.secure_url;
    }
    if (files?.administrationLetter) {
      const result = await this.cloudinaryService.uploadFile(
        files.administrationLetter,
        {
          folder: "school-social/administration-letters",
          resourceType: "image",
        },
      );
      administrationLetterUrl = result.secure_url;
    }

    try {
      const updatedUser = await this.usersService.update(userId, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        schoolId: dto.schoolId,
        facultyId: dto.facultyId,
        departmentId: dto.departmentId,
        matricNumber: dto.matricNumber || undefined,
        jambNumber: dto.jambNumber || undefined,
        username: dto.username,
        phoneNumber: dto.phoneNumber,
        profilePictureUrl,
        schoolIdCardUrl,
        administrationLetterUrl,
        termsAccepted: true,
        termsAcceptedAt: new Date(),
        status: UserStatus.ACTIVE,
        onboardingStep: OnboardingStep.COMPLETED,
        isOnboardingComplete: true,
      });

      try {
        await this.groupsService.autoJoinSystemGroups(
          userId,
          dto.schoolId,
          dto.facultyId,
          dto.departmentId,
        );
      } catch (err) {
        // A group-provisioning failure must not block onboarding completion,
        // and must not be mistaken for the duplicate-key ConflictException below.
        this.logger.error("autoJoinSystemGroups failed", err);
      }

      const { password, ...userWithoutPassword } = updatedUser;

      return {
        message: "Onboarding completed successfully! Welcome to School Social.",
        user: userWithoutPassword,
      };
    } catch (error: any) {
      if (error.code === "23505" || error.message.includes("duplicate key")) {
        throw new ConflictException(
          "A user with this Username, Phone Number, Matric Number, or JAMB Number already exists.",
        );
      }
      throw error;
    }
  }

  // ========== REFRESH TOKEN ==========
  async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get("JWT_REFRESH_SECRET"),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user || user.status === UserStatus.SUSPENDED) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
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
      throw new NotFoundException("User not found");
    }

    const missingFields: string[] = [];

    if (!user.firstName || !user.lastName)
      missingFields.push("firstName", "lastName");
    if (!user.dateOfBirth) missingFields.push("dateOfBirth");
    if (!user.gender) missingFields.push("gender");
    if (!user.schoolId) missingFields.push("school");
    if (!user.facultyId) missingFields.push("faculty");
    if (!user.departmentId) missingFields.push("department");
    if (!user.username) missingFields.push("username");
    if (!user.phoneNumber) missingFields.push("phoneNumber");
    if (!user.termsAccepted) missingFields.push("termsAccepted");
    if (!user.profilePictureUrl) missingFields.push("profilePicture");
    if (!user.schoolIdCardUrl) missingFields.push("schoolIdCard");
    if (!user.administrationLetterUrl)
      missingFields.push("administrationLetter");
    if (!user.matricNumber && !user.jambNumber)
      missingFields.push("matricNumber or jambNumber");

    return {
      isComplete: user.isOnboardingComplete,
      step: user.onboardingStep,
      missingFields,
    };
  }

  // ========== STEP 1: FORGOT PASSWORD (SEND OTP) ==========
  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string; email: string }> {
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);
    if (!user) {
      throw new NotFoundException("No account found with this email address");
    }

    await this.otpService.generateAndSendOtp(user, OtpPurpose.PASSWORD_RESET);

    return {
      message: "Password reset OTP has been sent to your email.",
      email: user.email,
    };
  }

  // ========== STEP 2: VERIFY RESET OTP ==========
  async verifyResetOtp(
    verifyResetOtpDto: VerifyResetOtpDto,
  ): Promise<{ message: string; resetToken: string }> {
    const user = await this.usersService.findByEmail(verifyResetOtpDto.email);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const isValid = await this.otpService.verifyOtp(
      user.id,
      verifyResetOtpDto.code,
      OtpPurpose.PASSWORD_RESET,
    );
    if (!isValid) {
      throw new BadRequestException("Invalid or expired OTP code");
    }

    const resetToken = this.jwtService.sign(
      { sub: user.id, email: user.email, type: "password-reset" },
      {
        secret: this.configService.get("JWT_REFRESH_SECRET"),
        expiresIn: "15m",
      },
    );

    return {
      message: "OTP verified successfully. You may now reset your password.",
      resetToken,
    };
  }

  // ========== STEP 3: RESET PASSWORD WITH TOKEN ==========
  async resetPassword(
    resetPasswordDto: ResetPasswordWithTokenDto,
  ): Promise<AuthResponse> {
    let payload: any;
    try {
      payload = this.jwtService.verify(resetPasswordDto.resetToken, {
        secret: this.configService.get("JWT_REFRESH_SECRET"),
      });

      if (payload.type !== "password-reset") {
        throw new UnauthorizedException("Invalid token type");
      }
    } catch (error) {
      console.error("Reset Token Verification Error:", error);
      throw new UnauthorizedException(
        "The password reset session has expired or is invalid",
      );
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.password, 12);

    const updatedUser = await this.usersService.update(user.id, {
      password: hashedPassword,
      isEmailVerified: true,
      passwordChangedAt: new Date(),
    });

    const tokens = await this.generateTokens(updatedUser);
    const onboardingRequired = !updatedUser.isOnboardingComplete;
    const onboardingStep = updatedUser.onboardingStep;

    const academicDetails = await this.getUserAcademicDetails(updatedUser);
    const { password, ...userWithoutPassword } = updatedUser;

    return {
      ...tokens,
      user: {
        ...userWithoutPassword,
        ...academicDetails,
      },
      onboardingRequired,
      onboardingStep,
    };
  }

  // ========== CHANGE PASSWORD (LOGGED IN) ==========
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<AuthResponse> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!user.password) {
      throw new BadRequestException('Your account does not have a password. Please use Google Sign-In.');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new BadRequestException("Current password is incorrect");
    }

    if (changePasswordDto.currentPassword === changePasswordDto.newPassword) {
      throw new BadRequestException("New password must be different from the current password");
    }

    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 12);

    const updatedUser = await this.usersService.update(user.id, {
      password: hashedPassword,
      passwordChangedAt: new Date(),
    });

    const tokens = await this.generateTokens(updatedUser);
    const onboardingRequired = !updatedUser.isOnboardingComplete;
    const onboardingStep = updatedUser.onboardingStep;

    await this.gamificationService.recordDailyLogin(updatedUser.id);
    const levelStats = await this.gamificationService.getMe(updatedUser.id);

    const academicDetails = await this.getUserAcademicDetails(updatedUser);
    const { password, ...userWithoutPassword } = updatedUser;

    return {
      ...tokens,
      user: {
        ...userWithoutPassword,
        ...academicDetails,
        appLevel: levelStats.level,
        gamification: {
          totalXp: levelStats.totalXp,
          nextLevel: levelStats.nextLevel,
          progress: levelStats.progress,
          currentStreak: levelStats.currentStreak,
        },
      },
      onboardingRequired,
      onboardingStep,
    };
  }

  // ========== REACTIVATE ACCOUNT (OTP-GATED) ==========
  async sendReactivationOtp(
    resendOtpDto: ResendOtpDto,
  ): Promise<{ message: string; email: string }> {
    const user = await this.usersService.findByEmail(resendOtpDto.email);
    if (!user) {
      throw new NotFoundException("No account found with this email address");
    }

    if (user.deletedAt) {
      throw new BadRequestException(
        "This account has been deleted and can no longer be used.",
      );
    }

    if (!user.deactivatedAt) {
      throw new BadRequestException(
        "This account is not deactivated. You can log in normally.",
      );
    }

    await this.otpService.generateAndSendOtp(user, OtpPurpose.ACCOUNT_REACTIVATION);

    return {
      message: "A reactivation code has been sent to your email.",
      email: user.email,
    };
  }

  async reactivateAccount(dto: ReactivateAccountDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (!user.password) {
      throw new UnauthorizedException('Your account does not have a password. Please use Google Sign-In.');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.deletedAt) {
      throw new UnauthorizedException(
        "This account has been deleted and can no longer be used.",
      );
    }

    if (!user.deactivatedAt) {
      throw new BadRequestException(
        "This account is not deactivated. You can log in normally.",
      );
    }

    // Require the OTP sent to the user's email before reactivating
    const isValidOtp = await this.otpService.verifyOtp(
      user.id,
      dto.code,
      OtpPurpose.ACCOUNT_REACTIVATION,
    );
    if (!isValidOtp) {
      throw new BadRequestException("Invalid or expired OTP code");
    }

    // Bring the account back
    await this.usersService.update(user.id, { deactivatedAt: null });
    user.deactivatedAt = null;

    // Notify the user that their account is active again. Email failures
    // must never block the reactivation itself.
    try {
      await this.otpService.sendReactivationEmail(user);
    } catch (error) {
      this.logger.error('Failed to send reactivation email', error);
    }

    const onboardingRequired = !user.isOnboardingComplete;
    const onboardingStep = user.onboardingStep;

    const tokens = await this.generateTokens(user);

    if (user.status !== UserStatus.ACTIVE) {
      await this.usersService.update(user.id, { status: UserStatus.ACTIVE });
    }

    await this.gamificationService.recordDailyLogin(user.id);
    const levelStats = await this.gamificationService.getMe(user.id);

    // Fetch school, faculty, and department names
    const academicDetails = await this.getUserAcademicDetails(user);

    const { password, ...userWithoutPassword } = user;

    return {
      ...tokens,
      user: {
        ...userWithoutPassword,
        ...academicDetails,
        appLevel: levelStats?.level ?? null,
        gamification: levelStats,
      },
      onboardingRequired,
      onboardingStep,
    };
  }

  // ========== DEACTIVATE ACCOUNT (TEMPORARY) ==========
  async deactivateAccount(
    userId: string,
    accountActionDto: AccountActionDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.deletedAt) {
      throw new BadRequestException(
        "This account has been deleted and can no longer be used.",
      );
    }

    if (!user.password) {
      throw new BadRequestException('Your account does not have a password. Please use Google Sign-In.');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      accountActionDto.currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new BadRequestException("Current password is incorrect");
    }

    await this.usersService.update(user.id, {
      deactivatedAt: new Date(),
      // Invalidate all existing sessions immediately
      passwordChangedAt: new Date(),
    });

    return {
      message:
        "Your account has been deactivated. You can reactivate it anytime by logging back in.",
    };
  }

  // ========== DELETE ACCOUNT (PERMANENT) ==========
  async deleteAccount(
    userId: string,
    accountActionDto: AccountActionDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.deletedAt) {
      throw new BadRequestException(
        "This account has already been deleted.",
      );
    }

    if (!user.password) {
      throw new BadRequestException('Your account does not have a password. Please use Google Sign-In.');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      accountActionDto.currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new BadRequestException("Current password is incorrect");
    }

    // Anonymize the account so it can no longer be used or identified, but
    // keep the row so related content (posts, comments, etc.) stays intact.
    const deletedSuffix = `${Date.now()}-${user.id.slice(0, 8)}`;
    await this.usersService.update(user.id, {
      email: `deleted-${deletedSuffix}@deleted.local`,
      username: `deleted_${deletedSuffix}`,
      phoneNumber: `deleted-${deletedSuffix}`,
      firstName: "Deleted",
      lastName: "User",
      bio: "",
      profilePictureUrl: "",
      deletedAt: new Date(),
      deactivatedAt: null,
      // Invalidate all existing sessions immediately
      passwordChangedAt: new Date(),
    });

    return {
      message:
        "Your account has been permanently deleted. We're sorry to see you go.",
    };
  }

  // ========== STUDENT VERIFICATION (LOGGED IN) ==========
  async submitStudentVerification(
    userId: string,
    files?: {
      schoolIdCard?: Express.Multer.File;
      administrationLetter?: Express.Multer.File;
    },
  ): Promise<{ message: string; user: Partial<User> }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.verificationStatus === "verified") {
      throw new BadRequestException("Your account is already verified");
    }

    if (!files?.schoolIdCard && !files?.administrationLetter) {
      throw new BadRequestException(
        "Please upload at least one document: your student ID card or admission letter.",
      );
    }

    let schoolIdCardUrl = user.schoolIdCardUrl;
    let administrationLetterUrl = user.administrationLetterUrl;

    if (files?.schoolIdCard) {
      const result = await this.cloudinaryService.uploadFile(
        files.schoolIdCard,
        {
          folder: "school-social/school-id-cards",
          resourceType: "image",
        },
      );
      schoolIdCardUrl = result.secure_url;
    }
    if (files?.administrationLetter) {
      const result = await this.cloudinaryService.uploadFile(
        files.administrationLetter,
        {
          folder: "school-social/administration-letters",
          resourceType: "image",
        },
      );
      administrationLetterUrl = result.secure_url;
    }

    const updatedUser = await this.usersService.update(userId, {
      schoolIdCardUrl,
      administrationLetterUrl,
      verificationStatus: "pending",
    });

    const { password, ...userWithoutPassword } = updatedUser;

    return {
      message:
        "Your documents have been submitted. Verification usually takes less than 24 hours.",
      user: userWithoutPassword,
    };
  }

  async validateAndSuggestUsername(username: string): Promise<{ available: boolean; suggestions: string[] }> {
    const normalized = username.toLowerCase().trim().replace(/\s+/g, '');
    const existingUser = await this.usersService.findByUsername(normalized);

    if (!existingUser) {
      return {
        available: true,
        suggestions: [],
      };
    }

    const rawSuggestions: string[] = [];

    const randomSuffixes = [
      Math.floor(10 + Math.random() * 90),     
      Math.floor(100 + Math.random() * 900),   
      new Date().getFullYear(),               
    ];

    randomSuffixes.forEach(suffix => {
      rawSuggestions.push(`${normalized}${suffix}`);
    });

    rawSuggestions.push(`${normalized}_`);
    rawSuggestions.push(`the${normalized}`);

    const takenUsernames = await this.usersService.findTakenUsernames(rawSuggestions);

    const uniqueAvailableSuggestions = rawSuggestions
      .filter(item => !takenUsernames.includes(item))
      .slice(0, 3);

    return {
      available: false,
      suggestions: uniqueAvailableSuggestions,
    };
  }

  async validatePhoneUniqueness(phone: string): Promise<{ available: boolean }> {
    const normalized = phone.trim();
    const existingUser = await this.usersService.findByPhoneNumber(normalized);

    return {
      available: !existingUser,
    };
  }

  // ========== GOOGLE LOGIN ==========
 async googleLogin(idToken: string): Promise<AuthResponse> {
  // Verify the Google ID token by calling Google's tokeninfo endpoint
  let googleUser: { email: string; sub: string; name?: string; picture?: string; given_name?: string; family_name?: string };
  try {
    const response = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
    );
    googleUser = response.data;
  } catch (error) {
    throw new UnauthorizedException('Invalid or expired Google token');
  }

  if (!googleUser?.email) {
    throw new UnauthorizedException('Could not extract email from Google token');
  }

  // Check if user already exists
  const existingUser = await this.usersService.findByEmail(googleUser.email);

  if (existingUser) {
    // Existing user — link Google account if not already linked
    if (!existingUser.googleId) {
      await this.usersService.update(existingUser.id, {
        googleId: googleUser.sub,
        isEmailVerified: true,
      });
      existingUser.googleId = googleUser.sub;
      existingUser.isEmailVerified = true;
    }

    // Handle deactivated accounts
    if (existingUser.deactivatedAt) {
      throw new UnauthorizedException('Your account has been deactivated. Please contact support.');
    }

    if (existingUser.deletedAt) {
      throw new UnauthorizedException('This account has been deleted.');
    }

    // Handle 2FA
    if (existingUser.twoFactorEnabled) {
      await this.otpService.generateAndSendOtp(existingUser, OtpPurpose.TWO_FACTOR_AUTH);
      return {
        twoFactorRequired: true,
        email: existingUser.email,
        userId: existingUser.id,
      } as any;
    }

    return this.buildAuthResponse(existingUser);
  }

  // New user — create account from Google data
  const newUser = await this.usersService.create({
    email: googleUser.email,
    password: null, // No password for Google users
    firstName: googleUser.given_name || googleUser.name?.split(' ')[0] || null,
    lastName: googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || null,
    profilePictureUrl: googleUser.picture || null,
    isEmailVerified: true,
    googleId: googleUser.sub,
    status: UserStatus.PENDING_ONBOARDING,
    onboardingStep: OnboardingStep.NONE,
  } as any);

  try {
    await this.gamificationService.recordDailyLogin(newUser.id);
  } catch (err) {
    this.logger.error('Failed to record daily login for Google user', err);
  }

  const tokens = await this.generateTokens(newUser);
  const { password, ...userWithoutPassword } = newUser;

  return {
    ...tokens,
    user: userWithoutPassword,
    onboardingRequired: true,
    onboardingStep: OnboardingStep.NONE,
  };
}

  // ========== PRIVATE: Generate Tokens ==========
  private async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get("JWT_REFRESH_SECRET"),
      expiresIn: this.configService.get("JWT_REFRESH_EXPIRATION", "7d"),
    });

    return { accessToken, refreshToken };
  }
}