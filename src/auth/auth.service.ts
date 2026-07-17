import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
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
import { VerifyOtpDto } from "../users/dto/verify-otp.dto";
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
import {
  User,
  UserStatus,
  OnboardingStep,
} from "../users/entities/user.entity";
import { OtpPurpose } from "src/otp/entities/otp.entity";

export interface VerifyOtpResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  user: Partial<User>;
  onboardingRequired: boolean;
  onboardingStep: string;
}
import { GamificationService } from '../gamification/gamification.service';

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
    private readonly facultiesService: FacultiesService,
    private readonly departmentsService: DepartmentsService,
    private readonly gamificationService: GamificationService,
  ) {}

  // ========== SIGN UP ==========
  async signUp(
    createUserDto: CreateUserDto,
  ): Promise<{ message: string; email: string }> {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(
      createUserDto.email,
    );
    if (existingUser) {
      throw new ConflictException("An account with this email already exists");
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
      message:
        "Account created successfully. Please verify your email with the OTP sent.",
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

    // Mark email as verified and update status
    const updatedUser = await this.usersService.update(user.id, {
      isEmailVerified: true,
      status: UserStatus.PENDING_ONBOARDING,
      onboardingStep: OnboardingStep.EMAIL_VERIFIED,
    });

    // 1. Generate access and refresh tokens for this newly verified user
    const tokens = await this.generateTokens(updatedUser);

    // 2. Prepare payload flags for onboarding routing
    const onboardingRequired = !updatedUser.isOnboardingComplete;
    const onboardingStep = updatedUser.onboardingStep;

    const { password, ...userWithoutPassword } = updatedUser;

    // 3. Return the payload to instantly log them in on the client side
    return {
      message: "Email verified successfully. Welcome!",
      ...tokens,
      user: userWithoutPassword,
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
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      await this.otpService.generateAndSendOtp(user);
      throw new UnauthorizedException(
        "Please verify your email before logging in. A new OTP has been sent to your email.",
      );
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

    await this.gamificationService.recordDailyLogin(user.id);

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

    // 2. NEW: Check phone number uniqueness (Prevents the constraint crash)
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

    // Check username uniqueness
    const existingUsername = await this.usersService.findByUsername(
      dto.username,
    );
    if (existingUsername && existingUsername.id !== userId) {
      throw new ConflictException("Username is already taken");
    }

    if (!dto.termsAccepted) {
      throw new BadRequestException("You must accept the terms and conditions");
    }

    // Validate faculty/department belong to the selected school/faculty
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

    // Handle file uploads
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

    // Update user with all onboarding data

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

      const { password, ...userWithoutPassword } = updatedUser;

      return {
        message: "Onboarding completed successfully! Welcome to School Social.",
        user: userWithoutPassword,
      };
    } catch (error: any) {
      // Catch Postgres duplicate key error code (23505)
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

    // Generate and send password reset OTP
    await this.otpService.generateAndSendOtp(user, OtpPurpose.PASSWORD_RESET);

    return {
      message: "Password reset OTP has been sent to your email.",
      email: user.email,
    };
  }

  // ========== STEP 2: VERIFY RESET OTP (CORRECTED) ==========
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

    // Explicitly pass the secret here when signing
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

  // ========== STEP 3: RESET PASSWORD WITH TOKEN (CORRECTED) ==========
  async resetPassword(
    resetPasswordDto: ResetPasswordWithTokenDto,
  ): Promise<AuthResponse> {
    let payload: any;
    try {
      // Verifies using the exact same secret used above
      payload = this.jwtService.verify(resetPasswordDto.resetToken, {
        secret: this.configService.get("JWT_REFRESH_SECRET"),
      });

      if (payload.type !== "password-reset") {
        throw new UnauthorizedException("Invalid token type");
      }
    } catch (error) {
      console.log("the errr", error);
      // Log the actual error internally to help you debug during development
      console.error("Reset Token Verification Error:");
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
    });

    const tokens = await this.generateTokens(updatedUser);
    const onboardingRequired = !updatedUser.isOnboardingComplete;
    const onboardingStep = updatedUser.onboardingStep;

    const { password, ...userWithoutPassword } = updatedUser;

    return {
      ...tokens,
      user: userWithoutPassword,
      onboardingRequired,
      onboardingStep,
    };
  }

  async validateAndSuggestUsername(username: string): Promise<{ available: boolean; suggestions: string[] }> {
    const normalized = username.toLowerCase().trim().replace(/\s+/g, '');
    const existingUser = await this.usersService.findByUsername(normalized);

    // Case 1: Username is available
    if (!existingUser) {
      return {
        available: true,
        suggestions: [],
      };
    }

    // Case 2: Username is taken, build suggestions
    const rawSuggestions: string[] = [];
    
    // Generate potential options
    const randomSuffixes = [
      Math.floor(10 + Math.random() * 90),     
      Math.floor(100 + Math.random() * 900),   
      new Date().getFullYear(),               
    ];

    randomSuffixes.forEach(suffix => {
      rawSuggestions.push(`${normalized}${suffix}`);
    });
    
    // Add extra clean variations
    rawSuggestions.push(`${normalized}_`);
    rawSuggestions.push(`the${normalized}`);

    // Batch query the database to find which generated items are already taken
    const takenUsernames = await this.usersService.findTakenUsernames(rawSuggestions);

    // Filter down to available selections only, capped at 3 suggestions
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
