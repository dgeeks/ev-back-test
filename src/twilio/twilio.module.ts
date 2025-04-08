import { Module } from '@nestjs/common';
import { TwilioService } from './twilio.service';
import { SmsController } from './twilio.controller';

@Module({
  providers: [TwilioService],
  controllers: [SmsController],
  exports: [TwilioService],
})
export class TwilioModule {}
