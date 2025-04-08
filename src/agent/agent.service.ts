import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Agent } from './entities/agent.entity';
import { Repository } from 'typeorm';
import { BcryptService } from '../common/services/bcrypt.service';
import { FileService } from '../file/file.service';

@Injectable()
export class AgentService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    private readonly bcryptService: BcryptService,
    private fileService: FileService
  ) {}

  private async agentExists(email: string): Promise<boolean> {
    const agent = await this.agentRepository.findOne({ where: { email } });
    return !!agent;
  }

  async createAgent(createAgentDto: CreateAgentDto): Promise<Agent> {
    if (await this.agentExists(createAgentDto.email)) {
      throw new BadRequestException('Email already in use');
    }

    const password = await this.bcryptService.hashPassword(
      createAgentDto.password,
    );
    const agent = this.agentRepository.create({ ...createAgentDto, password });

    return this.agentRepository.save(agent);
  }

  async findAllAgents(): Promise<Agent[]> {
    return await this.agentRepository.find({
      relations: ['services']
    });
  }

  async findOneAgent(id: string): Promise<Agent> {
    const agent = await this.agentRepository.findOne({ where: { id } });
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    return agent;
  }

  async updateAgent(
    id: string,
    updateAgentDto: UpdateAgentDto,
  ): Promise<Agent> {
    const agent = await this.findOneAgent(id);
    Object.assign(agent, updateAgentDto);
    return await this.agentRepository.save(agent);
  }

  async deleteAgent(id: string): Promise<void> {
    const result = await this.agentRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
  }

  async findAgentByEmail(email: string): Promise<Agent | null> {
    return this.agentRepository.findOne({
      where: { email },
    });
  }

  async findAgentWithPassword(email: string): Promise<Agent> {
    const agent = await this.agentRepository.findOne({
      where: { email },
      select: ['id', 'password', 'email', 'role', 'isVerified'],
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return agent;
  }

  async updateAgentLatitudeAndLongitude(
    agentId: string,
    updateData: { latitude: number; longitude: number },
  ) {
    const agent = await this.agentRepository.findOne({
      where: { id: agentId },
    });
    if (!agent) {
      throw new Error('Agent not found');
    }

    agent.latitude = updateData.latitude;
    agent.longitude = updateData.longitude;

    return await this.agentRepository.save(agent);
  }

  async createUnverifiedAgent(createAgentDto: CreateAgentDto): Promise<Agent> {
    const hashedPassword = await this.bcryptService.hashPassword(
      createAgentDto.password,
    );

    const agent = this.agentRepository.create({
      ...createAgentDto,
      password: hashedPassword,
      isVerified: false,
    });

    return this.agentRepository.save(agent);
  }

  async findAgentByMobileNumber(mobileNumber: string): Promise<Agent | null> {
    return this.agentRepository.findOne({ where: { mobileNumber } });
  }

  async markAgentAsVerified(id: string): Promise<Agent> {
    const agent = await this.agentRepository.findOne({ where: { id } });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    agent.isVerified = true;
    const updatedAgent = await this.agentRepository.save(agent);

    return updatedAgent;
  }

  async findAgentByVerificationSessionId(
    sessionId: string,
  ): Promise<Agent | null> {
    return this.agentRepository.findOne({
      where: { licenseVerificationSessionId: sessionId },
    });
  }

  async updateAgentInsuranceDetails(
    agentId: string,
    insuranceDetails: {
      insured_name?: string;
      policy_number?: string;
      insurance_provider?: string;
      policy_type?: string;
      effective_date?: string;
      expiration_date?: string;
    },
  ): Promise<Agent> {
    const agent = await this.agentRepository.findOne({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${agentId} not found`);
    }

    agent.insuranceDetails = {
      ...agent.insuranceDetails,
      ...insuranceDetails,
    };

    return this.agentRepository.save(agent);
  }

  async updateAgentDriverLicenseDetails(
    agentId: string,
    licenseDetails: {
      licenseNumber?: string;
      licenseExpirationDate?: Date | null;
    },
  ): Promise<Agent> {
    const agent = await this.agentRepository.findOne({
      where: { id: agentId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    if (licenseDetails.licenseNumber !== undefined) {
      agent.licenseNumber = licenseDetails.licenseNumber;
    }
    if (licenseDetails.licenseExpirationDate !== undefined) {
      agent.licenseExpirationDate =
        licenseDetails.licenseExpirationDate ?? agent.licenseExpirationDate;
    }

    return this.agentRepository.save(agent);
  }

  async saveAgent(agent: Agent): Promise<Agent> {
    return this.agentRepository.save(agent);
  }
}
