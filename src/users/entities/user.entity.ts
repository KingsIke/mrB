import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { Faculty } from '../../faculties/entities/faculty.entity';
import { Department } from '../../departments/entities/department.entity';

export enum UserGender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}

export enum UserStatus {
  PENDING_VERIFICATION = 'pending_verification',
  PENDING_ONBOARDING = 'pending_onboarding',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

export enum OnboardingStep {
  NONE = 'none',
  EMAIL_VERIFIED = 'email_verified',
  BASIC_INFO = 'basic_info',
  SCHOOL_INFO = 'school_info',
  PROFILE_SETUP = 'profile_setup',
  TERMS_ACCEPTED = 'terms_accepted',
  COMPLETED = 'completed',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // === Auth Fields ===
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  // === Onboarding Fields ===
  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName: string;
   @Column({ type: 'varchar', length: 100, nullable: true })
  bio: string;

  @Column({ type: 'varchar', length: 50, nullable: true, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  phoneNumber: string;

  @Column({ type: 'enum', enum: UserGender, nullable: true })
  gender: UserGender;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  profilePictureUrl: string;

  // === School Fields ===
  @ManyToOne(() => School, (school) => school.users, { nullable: true })
  @JoinColumn({ name: 'schoolId' })
  school: School;

  @Column({ type: 'uuid', nullable: true })
  schoolId: string;

  @ManyToOne(() => Faculty, { nullable: true })
  @JoinColumn({ name: 'facultyId' })
  faculty: Faculty;

  @Column({ type: 'uuid', nullable: true })
  facultyId: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @Column({ type: 'uuid', nullable: true })
  departmentId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  matricNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  jambNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  schoolIdCardUrl: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  administrationLetterUrl: string;

  // === Terms ===
  @Column({ type: 'boolean', default: false })
  termsAccepted: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  termsAcceptedAt: Date;

  // === Status ===
  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.PENDING_VERIFICATION })
  status: UserStatus;

  @Column({ type: 'enum', enum: OnboardingStep, default: OnboardingStep.NONE })
  onboardingStep: OnboardingStep;

  @Column({ type: 'boolean', default: false })
  isOnboardingComplete: boolean;

  @Column({ nullable: true, default: '#007AFF' })
bubbleColor: string;

@Column({ nullable: true, default: 'default' })
bubbleStyle: string;

  @Column({ type: 'boolean', default: false })
  "emailVerified": boolean;

  // === Timestamps ===
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // === Computed ===
  get fullName(): string {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    return this.firstName || this.lastName || '';
  }

  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail() {
    if (this.email) {
      this.email = this.email.toLowerCase().trim();
    }
  }
}
