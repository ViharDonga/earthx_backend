import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Set global API prefix (e.g. /api/auth/login)
  app.setGlobalPrefix('api');

  // Enable CORS for frontend clients
  app.enableCors({
    origin: [
      'https://earthxindia.com',
      'https://www.earthxindia.com',
      'https://api.earthxindia.com',
      'http://localhost:4200',
      'http://localhost:3000',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Enable ValidationPipe for request DTO validation
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

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
  logger.log(`🚀 EarthX Backend running on: http://localhost:${port}/api`);
  logger.log(`🔐 Authentication endpoints available at: http://localhost:${port}/api/auth`);
}
bootstrap();
