/**
 * Creates (or resets) the App Store / Google Play reviewer account: a fully
 * onboarded, email-verified, student-verified user, so reviewers can sign in
 * with email + password and reach every screen without uploading ID or
 * waiting for admin approval.
 *
 * Credentials come from the environment, never from the repo:
 *   REVIEWER_EMAIL=review@3names.ng REVIEWER_PASSWORD='...' npm run seed:reviewer
 *
 * Safe to re-run: it updates the existing account and resets its password
 * (which also signs out any existing reviewer sessions).
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../app.module';
import {
  OnboardingStep,
  User,
  UserGender,
  UserStatus,
} from '../../users/entities/user.entity';
import { Department } from '../../departments/entities/department.entity';
import { Faculty } from '../../faculties/entities/faculty.entity';
import { RefreshTokenService } from '../../auth/refresh-token.service';

async function bootstrap() {
  const email = process.env.REVIEWER_EMAIL?.toLowerCase().trim();
  const password = process.env.REVIEWER_PASSWORD;
  if (!email || !password) {
    throw new Error('Set REVIEWER_EMAIL and REVIEWER_PASSWORD');
  }
  if (password.length < 10) {
    throw new Error('REVIEWER_PASSWORD must be at least 10 characters');
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const users = dataSource.getRepository(User);

  // Any real department works; the reviewer just needs a complete academic profile.
  const department = await dataSource.getRepository(Department).findOne({ where: {} });
  if (!department) {
    throw new Error('No departments found. Run npm run seed:all first.');
  }
  const faculty = await dataSource
    .getRepository(Faculty)
    .findOneByOrFail({ id: department.facultyId });

  const now = new Date();
  const existing = await users.findOne({ where: { email } });

  const fields: Partial<User> = {
    email,
    password: await bcrypt.hash(password, 12),
    passwordChangedAt: existing ? now : null,
    firstName: 'App',
    lastName: 'Reviewer',
    username: process.env.REVIEWER_USERNAME || 'appreviewer',
    gender: UserGender.PREFER_NOT_TO_SAY,
    dateOfBirth: new Date('2000-01-01'),
    schoolId: faculty.schoolId,
    facultyId: faculty.id,
    departmentId: department.id,
    isEmailVerified: true,
    termsAccepted: true,
    termsAcceptedAt: now,
    status: UserStatus.ACTIVE,
    statusReason: null,
    verificationStatus: 'verified',
    verificationGraceExpiresAt: null,
    onboardingStep: OnboardingStep.COMPLETED,
    isOnboardingComplete: true,
    twoFactorEnabled: false,
    deactivatedAt: null,
    deletedAt: null,
  };

  if (existing) {
    await users.update(existing.id, fields);
    await app.get(RefreshTokenService).revokeAllForUser(existing.id);
    console.log(`✅ Reviewer account reset: ${email}`);
  } else {
    await users.save(users.create(fields));
    console.log(`✅ Reviewer account created: ${email}`);
  }

  await app.close();
}

bootstrap().catch((err) => {
  console.error('❌ Seed failed:', err.message ?? err);
  process.exit(1);
});
