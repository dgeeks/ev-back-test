import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { AgentService } from './agent.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { ApiTags } from '@nestjs/swagger';
import { AuthDecorator } from '../auth/decorators/auth.decorator';
import { Role } from '../common/enum/roles.enum';
import { Agent } from './entities/agent.entity';

@ApiTags('Agents')
@Controller('agents')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}
  @Post()
  create(@Body() createAgentDto: CreateAgentDto) {
    return this.agentService.createAgent(createAgentDto);
  }

  @Get('all-agents')
  findAll(): Promise<Agent[]> {
    return this.agentService.findAllAgents();
  }

  @AuthDecorator(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.agentService.findOneAgent(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAgentDto: UpdateAgentDto) {
    return this.agentService.updateAgent(id, updateAgentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.agentService.deleteAgent(id);
  }
}
