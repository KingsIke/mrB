import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { GiftsService } from '../../gifts/gifts.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const giftsService = app.get(GiftsService);

  await giftsService.seedGifts();
  console.log('✅ Gifts seeded successfully');

  await app.close();
}

bootstrap().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
