import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/http-exception.filter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter());
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
}

bootstrap();
