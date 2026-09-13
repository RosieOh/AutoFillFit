import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * 처리되지 않은 예외를 한곳에서 받는다.
 *
 * 기본 필터는 500을 내면서 스택만 stdout에 찍는다. 그러면
 * "어느 요청이 죽었는지", "누가 보낸 요청인지"를 사후에 이을 수 없다.
 * 요청 ID를 응답 헤더와 로그에 함께 남겨, 사용자가 알려 준 ID로
 * 서버 로그를 찾아갈 수 있게 한다.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Request');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const requestId = request.id ?? '-';
    const where = `${request.method} ${request.originalUrl ?? request.url}`;

    if (status >= 500) {
      /*
       * 5xx만 스택을 남긴다.
       * 400·401·404는 정상적인 흐름이라 스택을 남기면 진짜 장애가 파묻힌다.
       */
      this.logger.error(
        `[${requestId}] ${where} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`[${requestId}] ${where} → ${status}`);
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      response
        .status(status)
        .json(
          typeof body === 'string'
            ? { statusCode: status, message: body, requestId }
            : { ...(body as object), requestId },
        );
      return;
    }

    /*
     * 예상 못 한 예외의 내용은 클라이언트에 보내지 않는다.
     * DB 오류 메시지에는 테이블·컬럼 구조가 그대로 들어 있다.
     */
    response.status(status).json({
      statusCode: status,
      message: '요청을 처리하지 못했습니다.',
      requestId,
    });
  }
}
