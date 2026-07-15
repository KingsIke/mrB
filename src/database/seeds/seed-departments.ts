import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DepartmentsService } from '../../departments/departments.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const departmentsService = app.get(DepartmentsService);

  await departmentsService.seedDepartments();
  console.log('✅ Departments seeded successfully');

  await app.close();
}

bootstrap().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
