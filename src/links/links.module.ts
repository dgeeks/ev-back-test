import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Link } from './entities/link.entity';
import { LinksController } from './links.controller';
import { LinkService } from './links.service';
import { ServicesModule } from '../services/services.module';
import { TwilioModule } from '../twilio/twilio.module';


@Module({
  imports: [
    TwilioModule,
    TypeOrmModule.forFeature([Link]),
    forwardRef(() => ServicesModule),
  ],
  controllers: [LinksController],
  providers: [LinkService],
  exports: [LinkService],
})
export class LinksModule {}
