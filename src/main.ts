import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody is needed to verify the Paystack webhook's HMAC signature, which
  // must be computed over the exact raw request bytes, not the parsed JSON body.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Security headers
  app.use(helmet());

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Strips @Exclude()-marked fields (e.g. User.password) from every response,
  // regardless of which service/relation pulled the entity in — a backstop
  // against exactly this leaking through some future or overlooked endpoint.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS
  // Browsers may call the API only from these origins in production (the
  // 3names.ng website: coin top-up and download tracking). The mobile app
  // isn't a browser, so CORS doesn't apply to it.
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'https://www.3names.ng,https://3names.ng')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? corsOrigins : true,
    credentials: true,
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('School Social App API')
    .setDescription('Backend API for the School Social App')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication & Authorization')
    .addTag('Onboarding', 'User onboarding & profile setup')
    .addTag('Users', 'User management')
    .addTag('Posts', 'Post feed, likes, comments, reshares, favorites, reports')
    .addTag('Comments', 'Comment replies, likes, and reports')
    .addTag('Notifications', 'In-app notification feed')
    .addTag('Stories', '24h ephemeral stories, reactions, and replies')
    .addTag('Gamification', 'XP, levels, and streaks')
    .addTag('Coins', 'Campus Coins balance and Paystack purchases')
    .addTag('Gifts', 'Gift catalog and sending gifts')
    .addTag('Follows', 'Following and blocking other users')
    .addTag('Groups', 'Group creation, membership, and settings')
    .addTag('Group Messages', 'Group chat messages, attachments, and reactions')
    .addTag('Direct Messages', '1:1 conversations between users')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 School Social App API running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
