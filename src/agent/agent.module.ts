import { forwardRef, Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from './entities/agent.entity';
import { BcryptService } from '../common/services/bcrypt.service';
import { AgentGateway } from './agents.gateway';
import { FileModule } from '../file/file.module';

@Module({
  imports: [ forwardRef(() => FileModule),TypeOrmModule.forFeature([Agent])],
  controllers: [AgentController],
  providers: [AgentService, BcryptService, AgentGateway],
  exports: [AgentService, TypeOrmModule],
})
export class AgentModule {}
