import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import {
  AuthService,
  AuthResponse,
  DeactivatedAccountInfo,
  TwoFactorRequiredInfo,
} from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from '../users/dto/login.dto';
import { VerifyOtpDto } from '../users/dto/verify-otp.dto';
import { ResendOtpDto } from '../users/dto/resend-otp.dto';
import { CompleteOnboardingDto, ForgotPasswordDto, ResetPasswordWithTokenDto, VerifyResetOtpDto, } from '../users/dto/onboarding.dto';
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import { AccountActionDto } from '../users/dto/account-action.dto';
import { ReactivateAccountDto } from '../users/dto/reactivate-account.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { Verify2faDto } from '../users/dto/verify-2fa.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { memoryStorage } from 'multer';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new student account' })
  @ApiResponse({ status: 201, description: 'Account created, OTP sent' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async signUp(@Body() createUserDto: CreateUserDto) {
    return this.authService.signUp(createUserDto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with OTP' })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend OTP to email' })
  @ApiResponse({ status: 200, description: 'OTP resent' })
  async resendOtp(@Body() resendOtpDto: ResendOtpDto) {
    return this.authService.resendOtp(resendOtpDto);
  }

// ========== STEP 1: FORGOT PASSWORD ==========
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 1: Request a password reset OTP' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  // ========== STEP 2: VERIFY RESET OTP ==========
  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 2: Verify reset OTP & receive temporary reset token' })
  @ApiResponse({ status: 200, description: 'OTP verified, short-lived resetToken returned' })
  async verifyResetOtp(@Body() verifyResetOtpDto: VerifyResetOtpDto) {
    return this.authService.verifyResetOtp(verifyResetOtpDto);
  }

  // ========== STEP 3: RESET PASSWORD ==========
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 3: Complete password reset using the reset token' })
  @ApiResponse({ status: 200, description: 'Password reset successful, logged in' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordWithTokenDto): Promise<AuthResponse> {
    return this.authService.resetPassword(resetPasswordDto);
  }

    @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password while logged in (returns fresh tokens)' })
  @ApiResponse({ status: 200, description: 'Password changed successfully, fresh tokens returned' })
  @ApiResponse({ status: 400, description: 'Current password is incorrect or invalid input' })
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<AuthResponse> {
    return this.authService.changePassword(userId, changePasswordDto);
  }

  @Post('deactivate-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Temporarily deactivate the current account' })
  @ApiResponse({ status: 200, description: 'Account deactivated' })
  @ApiResponse({ status: 400, description: 'Current password is incorrect' })
  async deactivateAccount(
    @CurrentUser('userId') userId: string,
    @Body() accountActionDto: AccountActionDto,
  ) {
    return this.authService.deactivateAccount(userId, accountActionDto);
  }

  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete the current account' })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  @ApiResponse({ status: 400, description: 'Current password is incorrect' })
  async deleteAccount(
    @CurrentUser('userId') userId: string,
    @Body() accountActionDto: AccountActionDto,
  ) {
    return this.authService.deleteAccount(userId, accountActionDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful', type: Object })
  @ApiResponse({ status: 200, description: 'Account is deactivated (activate required)' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or unverified email' })
  async login(
    @Body() loginDto: LoginDto,
  ): Promise<AuthResponse | DeactivatedAccountInfo | TwoFactorRequiredInfo> {
    return this.authService.login(loginDto);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login or register with Google ID token' })
  @ApiResponse({ status: 200, description: 'Google auth successful' })
  @ApiResponse({ status: 401, description: 'Invalid Google token' })
  async googleLogin(@Body() googleLoginDto: GoogleLoginDto) {
    return this.authService.googleLogin(googleLoginDto.idToken);
  }

  // ========== TWO-FACTOR AUTHENTICATION ==========
  @Post('2fa/login-verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a 2FA-protected login with the emailed code' })
  @ApiResponse({ status: 200, description: '2FA verified, logged in' })
  @ApiResponse({ status: 401, description: 'Invalid or expired code' })
  async verify2faLogin(@Body() verify2faDto: Verify2faDto): Promise<AuthResponse> {
    return this.authService.verify2faLogin(verify2faDto);
  }

  @Post('2fa/resend-login-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend the 2FA login code to the user\'s email' })
  async resend2faLoginOtp(@Body() body: { email: string }) {
    return this.authService.resend2faLoginOtp(body?.email);
  }

  @Post('2fa/send-otp')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send the 2FA setup/disable code to the current user\'s email' })
  async send2faOtp(
    @CurrentUser('userId') userId: string,
    @Body() body: { action: 'enable' | 'disable' },
  ) {
    if (body?.action === 'disable') {
      return this.authService.send2faDisableOtp(userId);
    }
    return this.authService.send2faSetupOtp(userId);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable 2FA after verifying the emailed code' })
  async enable2fa(
    @CurrentUser('userId') userId: string,
    @Body() body: { code: string },
  ) {
    return this.authService.enable2fa(userId, body?.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA after verifying the emailed code' })
  async disable2fa(
    @CurrentUser('userId') userId: string,
    @Body() body: { code: string },
  ) {
    return this.authService.disable2fa(userId, body?.code);
  }

  @Post('reactivate-account/send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a reactivation OTP to the deactivated account\'s email' })
  @ApiResponse({ status: 200, description: 'OTP sent' })
  @ApiResponse({ status: 400, description: 'Account is not deactivated' })
  async sendReactivationOtp(@Body() resendOtpDto: ResendOtpDto) {
    return this.authService.sendReactivationOtp(resendOtpDto);
  }

  @Post('reactivate-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a deactivated account with OTP and log in' })
  @ApiResponse({ status: 200, description: 'Account reactivated', type: Object })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 400, description: 'Invalid OTP or account not deactivated' })
  async reactivateAccount(@Body() dto: ReactivateAccountDto): Promise<AuthResponse> {
    return this.authService.reactivateAccount(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  async refreshTokens(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshTokens(refreshToken);
  }

  @Post('onboarding')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profilePicture', maxCount: 1 },
        { name: 'schoolIdCard', maxCount: 1 },
        { name: 'administrationLetter', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB
        },
        fileFilter: (req, file, callback) => {
          const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
          if (allowedMimes.includes(file.mimetype)) {
            callback(null, true);
          } else {
            callback(new Error('Only image files (JPEG, PNG, WebP) are allowed'), false);
          }
        },
      },
    ),
  )
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Complete user onboarding' })
  @ApiResponse({ status: 200, description: 'Onboarding completed' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  async completeOnboarding(
    @CurrentUser('userId') userId: string,
    @Body() dto: CompleteOnboardingDto,
    @UploadedFiles()
    files: {
      profilePicture?: Express.Multer.File[];
      schoolIdCard?: Express.Multer.File[];
      administrationLetter?: Express.Multer.File[];
    },
  ) {
    return this.authService.completeOnboarding(userId, dto, {
      profilePicture: files?.profilePicture?.[0],
      schoolIdCard: files?.schoolIdCard?.[0],
      administrationLetter: files?.administrationLetter?.[0],
    });
  }

  @Post('student-verification')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'schoolIdCard', maxCount: 1 },
        { name: 'administrationLetter', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (req, file, callback) => {
          const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
          if (allowedMimes.includes(file.mimetype)) {
            callback(null, true);
          } else {
            callback(new Error('Only image files (JPEG, PNG, WebP) are allowed'), false);
          }
        },
      },
    ),
  )
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit documents for student verification' })
  @ApiResponse({ status: 200, description: 'Verification documents submitted' })
  @ApiResponse({ status: 400, description: 'Missing documents or invalid input' })
  async submitStudentVerification(
    @CurrentUser('userId') userId: string,
    @UploadedFiles()
    files: {
      schoolIdCard?: Express.Multer.File[];
      administrationLetter?: Express.Multer.File[];
    },
  ) {
    return this.authService.submitStudentVerification(userId, {
      schoolIdCard: files?.schoolIdCard?.[0],
      administrationLetter: files?.administrationLetter?.[0],
    });
  }

  @Get('onboarding-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check onboarding completion status' })
  @ApiResponse({ status: 200, description: 'Onboarding status' })
  async checkOnboardingStatus(@CurrentUser('userId') userId: string) {
    return this.authService.checkOnboardingStatus(userId);
  }

  @Get('check-username')
  @ApiOperation({ summary: 'Check username availability and get suggestions' })
  async checkUsername(@Query('username') username: string) {
    if (!username || username.trim().length < 3) {
      throw new BadRequestException('Username must be at least 3 characters long');
    }
    return this.authService.validateAndSuggestUsername(username);
  }

  @Get('check-phone')
  @ApiOperation({ summary: 'Check phone number uniqueness' })
  async checkPhone(@Query('phone') phone: string) {
    if (!phone || phone.trim().length < 10) {
      throw new BadRequestException('Invalid phone number format');
    }
    return this.authService.validatePhoneUniqueness(phone);
  }
}
