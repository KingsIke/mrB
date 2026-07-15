import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { OtpCode } from '../otp/entities/otp.entity';
import { School } from '../schools/entities/school.entity';
import { Faculty } from '../faculties/entities/faculty.entity';
import { Department } from '../departments/entities/department.entity';

export const databaseConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    host: configService.get('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get('DB_USERNAME', 'postgres'),
    password: configService.get('DB_PASSWORD', 'postgres'),
    database: configService.get('DB_NAME', 'school_social_app'),
    entities: [User, OtpCode, School, Faculty, Department],
    synchronize: configService.get('NODE_ENV') !== 'production',
    logging: configService.get('NODE_ENV') === 'development',
    migrations: ['dist/database/migrations/*{.ts,.js}'],
    migrationsRun: true,
  }),
};
