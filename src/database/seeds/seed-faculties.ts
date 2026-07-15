import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { FacultiesService } from '../../faculties/faculties.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const facultiesService = app.get(FacultiesService);

  await facultiesService.seedFaculties();
  console.log('✅ Faculties seeded successfully');

  await app.close();
}

bootstrap().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
