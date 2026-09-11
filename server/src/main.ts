import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 없는 속성 제거
      forbidNonWhitelisted: true, // 정의되지 않은 속성이 오면 400
      transform: true, // payload를 DTO 인스턴스로 변환
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Chrome Extension(content script)에서의 fetch를 허용한다.
  const origins = config
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.length > 0 ? origins : true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // JWT는 Authorization 헤더로 전달하므로 쿠키는 사용하지 않는다.
    credentials: false,
  });

  const port = config.get<number>('PORT', 4000);
  await app.listen(port);

  console.log(`AutoFill-Fit API listening on http://localhost:${port}`);
}

void bootstrap();
