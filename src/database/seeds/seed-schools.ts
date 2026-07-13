import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { SchoolsService } from '../../schools/schools.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const schoolsService = app.get(SchoolsService);

  await schoolsService.seedSchools();
  console.log('✅ Schools seeded successfully');

  await app.close();
}

bootstrap().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
