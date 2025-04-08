import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioService {
  private client: Twilio;
  private from: string;
  private serviceSid: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new Twilio(
      this.configService.get<string>('TWILIO_ACCOUNT_SID'),
      this.configService.get<string>('TWILIO_AUTH_TOKEN'),
    );
    this.from = this.configService.get<string>('TWILIO_PHONE_NUMBER') ?? '';
    this.serviceSid = this.configService.get<string>('TWILIO_SERVICE_SID') ?? '';
  }

  async sendSms(to: string, message: string): Promise<any> {
    try {
      return await this.client.messages.create({
        body: message,
        from: this.from,
        to,
      });
    } catch (error) {
      throw new Error(`Error sending SMS: ${error.message}`);
    }
  }

  async sendWhatsApp(to: string, message: string): Promise<any> {
    try {
      return await this.client.messages.create({
        body: message,
        from: 'whatsapp:+14155238886',
        to: `whatsapp:${to}`,
      });
    } catch (error) {
      throw new Error(`Error sending WhatsApp message: ${error.message}`);
    }
  }

  async sendOtp(mobileNumber: string): Promise<any> {
    try {
      const formattedNumber = mobileNumber.startsWith('+')
        ? mobileNumber
        : `+${mobileNumber}`;
        
      return await this.client.verify.v2
        .services(this.serviceSid)
        .verifications.create({
          to: formattedNumber,
          channel: 'sms',
        });
    } catch (error) {
      throw new Error(`Error sending OTP: ${error.message}`);
    }
  }

  async verifyOtp(mobileNumber: string, code: string): Promise<boolean> {
    try {
      const formattedNumber = mobileNumber.startsWith('+')
        ? mobileNumber
        : `+${mobileNumber}`;
        
      const verificationCheck = await this.client.verify.v2
        .services(this.serviceSid)
        .verificationChecks.create({
          to: formattedNumber,
          code,
        });
      return verificationCheck.status === 'approved';
    } catch (error) {
      throw new Error(`Error verifying OTP: ${error.message}`);
    }
  }
}