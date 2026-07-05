import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import * as express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('API_PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // ── Security ────────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production',
      crossOriginEmbedderPolicy: nodeEnv === 'production',
    }),
  );

  // ── Compression ─────────────────────────────────────────────────────────
  app.use(compression());

  // ── Local uploaded assets (Sprint 1.2 storage adapter placeholder) ───────
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // ── CORS ────────────────────────────────────────────────────────────────
  app.enableCors({
    origin:
      nodeEnv === 'production'
        ? [configService.get<string>('FRONTEND_URL', 'https://cbt-platform.com')]
        : ['http://localhost:5173', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
  });

  // ── Global API Prefix & Versioning ──────────────────────────────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ── Global Validation Pipe ───────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // Strip unknown properties
      forbidNonWhitelisted: true,
      transform: true,        // Auto-transform primitives (string → number etc.)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());

  // ── Swagger (Dev Only) ───────────────────────────────────────────────────
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('CBT Platform API')
      .setDescription('Computer-Based Testing Platform — TSA HUST Simulation')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addTag('auth', 'Authentication & Authorization')
      .addTag('exams', 'Exam management')
      .addTag('sessions', 'Test-taking session engine')
      .addTag('results', 'Exam results & analytics')
      .addTag('admin', 'Admin-only operations')
      .addTag('health', 'Health checks')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
    logger.log(`📚 Swagger available at: http://localhost:${port}/api/docs`);
  }

  // ── Graceful Shutdown ────────────────────────────────────────────────────
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`🚀 CBT Platform API running at: http://localhost:${port}`);
  logger.log(`🌍 Environment: ${nodeEnv}`);
}

bootstrap();
