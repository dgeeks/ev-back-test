import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { BcryptService } from '../common/services/bcrypt.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { AgentModule } from '../agent/agent.module';
import { TwilioModule } from '../twilio/twilio.module';
import { VeriffModule } from '../veriff/veriff.module';
import { FileModule } from '../file/file.module';
import { DocumentsValidationService } from './documents-validation.service';

@Module({
  imports: [
    ConfigModule,
    AgentModule,
    TwilioModule,
    VeriffModule,
    FileModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('SECRET'),
        signOptions: { expiresIn: '10h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, BcryptService, JwtStrategy, DocumentsValidationService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
