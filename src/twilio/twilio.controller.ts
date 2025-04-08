import { Controller, Post, Body } from '@nestjs/common';
import { TwilioService } from '../twilio/twilio.service';

@Controller('sms')
export class SmsController {
  constructor(private readonly twilioService: TwilioService) {}

  @Post('send')
  async sendSms(@Body() body: { to: string; message: string }) {
    return this.twilioService.sendSms(body.to, body.message);
  }

  @Post('send-whatsapp')
  async sendWhatsApp(@Body() body: { to: string; message: string }) {
    return this.twilioService.sendWhatsApp(body.to, body.message);
  }
}
