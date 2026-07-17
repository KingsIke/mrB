import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { GamificationService } from '../../gamification/gamification.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const gamificationService = app.get(GamificationService);

  await gamificationService.seedLevels();
  console.log('✅ Levels seeded successfully');

  await app.close();
}

bootstrap().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
