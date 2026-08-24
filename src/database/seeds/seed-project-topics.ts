import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { ProjectTopicsService } from '../../project-topics/project-topics.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const projectTopicsService = app.get(ProjectTopicsService);

  const result = await projectTopicsService.seedProjectTopics();
  console.log(
    `✅ Project topics seeded: ${result.created} topics created across ${result.skipped} skipped departments`,
  );

  await app.close();
}

bootstrap().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
