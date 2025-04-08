import { Injectable, Logger } from '@nestjs/common';
import { TwilioService } from '../../twilio/twilio.service';


interface NotificationPayload {
  type: string;
  message: string;
  context?: any;
}

@Injectable()
export class AdminNotificationService {
  private readonly logger = new Logger(AdminNotificationService.name);

  private readonly ADMIN_PHONE = '+972539338038';

  constructor(private readonly twilioService: TwilioService) {}

  async notifyAdmin(payload: NotificationPayload): Promise<void> {
    try {


      await this.sendSmsNotification(payload);
    } catch (error) {
      this.logger.error(`Failed to send admin notification: ${error.message}`);
    }
  }

  private async sendSmsNotification(
    payload: NotificationPayload,
  ): Promise<void> {
    const message = `Hello David: ${payload.type}. ${payload.message}`;
    await this.twilioService.sendSms(this.ADMIN_PHONE, message);
  }
}
