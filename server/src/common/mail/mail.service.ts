import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * 메일 발송.
 *
 * `SMTP_URL`이 있으면 그리로 보내고, 없으면 보내는 대신 본문을 로그에 남긴다.
 * 개발·테스트에서 실제 메일 서버를 요구하지 않기 위해서다.
 *
 * 보낸 척하지 않는다 — 조용히 성공을 돌려주면 "재설정 메일이 안 와요"를
 * 영원히 디버깅하게 된다. `delivered`로 실제로 나갔는지 구분한다.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  private get smtpUrl(): string | null {
    const url = this.config.get<string>('SMTP_URL');
    return url && url.trim() !== '' ? url : null;
  }

  get isConfigured(): boolean {
    return this.smtpUrl !== null;
  }

  private get from(): string {
    return this.config.get<string>('MAIL_FROM', 'AutoFill-Fit <no-reply@localhost>');
  }

  async send(message: MailMessage): Promise<{ delivered: boolean }> {
    const url = this.smtpUrl;

    if (!url) {
      /*
       * 본문을 통째로 찍는다. 개발자가 이 로그에서 링크를 복사해
       * 재설정 흐름을 끝까지 확인할 수 있어야 한다.
       */
      this.logger.warn(
        `SMTP_URL이 없어 메일을 보내지 않았습니다.\n` +
          `  받는 사람: ${message.to}\n` +
          `  제목: ${message.subject}\n` +
          `${message.text}`,
      );
      return { delivered: false };
    }

    // 연결은 한 번만 만든다. 요청마다 만들면 SMTP 핸드셰이크가 매번 붙는다.
    this.transporter ??= createTransport(url);

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
      return { delivered: true };
    } catch (error) {
      /*
       * 호출한 쪽으로 던지지 않는다.
       *
       * 비밀번호 재설정 요청은 메일이 실패해도 200을 돌려줘야 한다.
       * 오류를 그대로 내면 "이 이메일은 가입돼 있다"는 사실이 새어 나간다.
       */
      this.logger.error(
        `메일 발송 실패: ${message.to}`,
        error instanceof Error ? error.stack : String(error),
      );
      return { delivered: false };
    }
  }
}
