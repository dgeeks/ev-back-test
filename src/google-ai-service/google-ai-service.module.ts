import { Module } from '@nestjs/common';
import { GoogleAiService } from './google-ai-service.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule,],
  providers: [GoogleAiService],
  exports: [GoogleAiService],
})
export class GoogleAiServiceModule {}