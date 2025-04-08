import { Module, forwardRef } from '@nestjs/common';
import { FileService } from './file.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { File } from './file.entity';
import { S3Module } from '../s3/s3.module';
import { AgentModule } from '../agent/agent.module';
import { GoogleAiServiceModule } from '../google-ai-service/google-ai-service.module';

@Module({
  imports: [
    S3Module,
    GoogleAiServiceModule,
    forwardRef(() => AgentModule),
    TypeOrmModule.forFeature([File])
  ],
  controllers: [],
  providers: [FileService],
  exports: [FileService]
})
export class FileModule {}