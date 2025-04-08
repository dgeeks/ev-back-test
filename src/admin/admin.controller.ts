import {
  Controller,
  Get,
  Body,
  Param,
  Delete,
  Query,
  HttpException,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpdateAgentDto } from '../agent/dto/update-agent.dto';
import { UpdateServiceDto } from '../services/dto/update-service.dto';
import {
  PaginationDto,
  SearchAgentsPaginationDto,
} from '../common/dto/pagination.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('agents-pagination')
  async getAgents(@Query() paginationDto: PaginationDto) {
    try {
      return await this.adminService.findAllAgents(paginationDto);
    } catch (error) {
      console.error('Error in getAgents:', error);
      throw new HttpException(
        `Error fetching agents: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('agents/search')
  async searchAgents(@Query() params: SearchAgentsPaginationDto) {
    return this.adminService.searchAgents(params.searchTerm, {
      page: params.page,
      limit: params.limit,
    });
  }

  @Get('agents/:id')
  async findOneAgent(@Param('id') id: string) {
    return this.adminService.findOneAgent(id);
  }

  @Patch('agents/:id')
  async updateAgent(
    @Param('id') id: string,
    @Body() updateAgentDto: UpdateAgentDto,
  ) {
    return this.adminService.updateAgent(id, updateAgentDto);
  }

  @Post('agents/:id/restore')
  async restoreAgent(@Param('id') id: string) {
    return this.adminService.restoreAgent(id);
  }

  @Delete('agents/:id')
  async deleteAgent(@Param('id') id: string) {
    return this.adminService.deleteAgent(id);
  }

  @Get('services-pagination')
  async findAllServices(@Query() paginationDto: PaginationDto) {
    return this.adminService.findAllServices(paginationDto);
  }

  @Get('services/search')
  async searchServices(
    @Query('query') query: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.adminService.searchServices(query, paginationDto);
  }

  @Get('services/:id')
  async findOneService(@Param('id') id: string) {
    return this.adminService.findOneService(id);
  }

  @Patch('services/:id')
  async updateService(
    @Param('id') id: string,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    return this.adminService.updateService(id, updateServiceDto);
  }

  @Delete('services/:id')
  async deleteService(@Param('id') id: string) {
    return this.adminService.deleteService(id);
  }

  @Get('stats/agents')
  async getAgentStatistics() {
    return this.adminService.getAgentStatistics();
  }

  @Get('stats/services')
  async getServiceStatistics() {
    return this.adminService.getServiceStatistics();
  }
}
