import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';
import { AuthModule } from './auth/auth.module';
import { AgentModule } from './agent/agent.module';
import { ServicesModule } from './services/services.module';
import { TwilioModule } from './twilio/twilio.module';
import { LinksModule } from './links/links.module';
import { VeriffModule } from './veriff/veriff.module';
import { GoogleAiServiceModule } from './google-ai-service/google-ai-service.module';
import { S3Module } from './s3/s3.module';
import { FileModule } from './file/file.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    AuthModule,
    AgentModule,
    ServicesModule,
    TwilioModule,
    LinksModule,
    VeriffModule,
    GoogleAiServiceModule,
    S3Module,
    FileModule,
    AdminModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
