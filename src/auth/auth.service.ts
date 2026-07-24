import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
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
import { GamificationService } from '../gamification/gamification.service';
import { SchoolsService } from "src/schools/schools.service";

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
    private readonly schoolsService: SchoolsService,
    private readonly gamificationService: GamificationService,
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
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (!user.isEmailVerified) {
      await this.otpService.generateAndSendOtp(user);
      throw new UnauthorizedException(
        "Please verify your email before logging in. A new OTP has been sent to your email.",
      );
    }

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
        }
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