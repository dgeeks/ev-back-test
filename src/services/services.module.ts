import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from './entities/service.entity';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { AgentModule } from '../agent/agent.module';
import { GoogleMapsService } from '../common/services/google-maps.service';
import { TwilioModule } from '../twilio/twilio.module';
import { LinksModule } from '../links/links.module';
import { Agent } from '../agent/entities/agent.entity';
import { AdminNotificationService } from '../common/services/adminNotification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Service, Agent]),
    AgentModule,
    TwilioModule,
    forwardRef(() => LinksModule),
  ],
  controllers: [ServicesController],
  providers: [ServicesService, GoogleMapsService, AdminNotificationService],
  exports: [ServicesService],
})
export class ServicesModule {}
