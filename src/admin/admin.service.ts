import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, FindOptionsWhere, ILike, IsNull, Not } from 'typeorm';
import { Agent } from '../agent/entities/agent.entity';
import { Service } from '../services/entities/service.entity';
import { UpdateAgentDto } from '../agent/dto/update-agent.dto';
import { UpdateServiceDto } from '../services/dto/update-service.dto';
import { IPaginationResponse, PaginationDto } from '../common/dto/pagination.dto';
import { ServiceStatus } from '../services/enums/service-status.enum';

type EntityWithId = { id: string };
type FindOptions<T extends EntityWithId> = FindManyOptions<T> & {
  where?: FindOptionsWhere<T> | FindOptionsWhere<T>[];
};

@Injectable()
export class AdminService {
  private readonly defaultRelations = {
    agents: ['services'],
    services: ['agent']
  };

  constructor(
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
  ) {}

  async findAllAgents(paginationDto: PaginationDto): Promise<IPaginationResponse<Omit<Agent, 'documents' | 'workAreas'>>> {
    const { page = 1, limit = 10 } = paginationDto;
    const pageNum = Number(page);
    const limitNum = Number(limit);
  
    const queryBuilder = this.agentRepository.createQueryBuilder('agent')
      .leftJoinAndSelect('agent.services', 'services')
      .select([
        'agent.id',
        'agent.firstName',
        'agent.lastName',
        'agent.email',
        'agent.address',
        'agent.mobileNumber',
        'agent.zipCode',
        'agent.city',
        'agent.state',
        'agent.country',
        'agent.isVerified',
        'agent.isAvailable',
        'agent.insuranceDetails',
        'agent.electricCertificateDetails',
        'agent.licenseNumber',
        'agent.licenseExpirationDate',
        'agent.licenseVerificationStatus',
        'agent.isLicenseVerified',
        'agent.workRadius',
        'agent.driverLicenseVerified',
        'agent.insuranceVerified',
        'agent.electricCertificateVerified',
        'agent.createdAt',
        'agent.updatedAt',
        'agent.deletedAt',
      ])
      .where('agent.deletedAt IS NULL')
      .skip((pageNum - 1) * limitNum)
      .take(limitNum)
      .orderBy('agent.createdAt', 'DESC');
  
    const [items, total] = await queryBuilder.getManyAndCount();
    
    return this.buildPaginationResponse(items, total, pageNum, limitNum);
  }

  async findOneAgent(id: string): Promise<Agent> {
    const options: FindOptions<Agent> = { 
      where: { id, deletedAt: IsNull() } as FindOptionsWhere<Agent>,
      relations: this.defaultRelations.agents
    };

    const entity = await this.agentRepository.findOne(options);
    if (!entity) {
      throw new Error(`Agent with ID ${id} not found`);
    }
    return entity;
  }

  async updateAgent(id: string, updateAgentDto: UpdateAgentDto): Promise<Agent> {
    const agent = await this.findOneAgent(id);
    return this.agentRepository.save({ ...agent, ...updateAgentDto });
  }

  async deleteAgent(id: string): Promise<{ message: string }> {
    await this.findOneAgent(id);
    await this.agentRepository.softDelete(id);
    return { message: `Agent with ID ${id} has been soft deleted` };
  }

  async restoreAgent(id: string): Promise<Agent> {
    await this.agentRepository.restore(id);
    return this.findOneAgent(id);
  }


  async findAllServices(paginationDto: PaginationDto): Promise<IPaginationResponse<Service>> {
    const { page = 1, limit = 10 } = paginationDto;
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const options: FindOptions<Service> = {
      relations: this.defaultRelations.services,
      where: { deletedAt: IsNull() },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      order: { createdAt: 'DESC' },
    };

    const [items, total] = await this.serviceRepository.findAndCount(options);
    return this.buildPaginationResponse(items, total, pageNum, limitNum);
  }

  async findOneService(id: string): Promise<Service> {
    const options: FindOptions<Service> = { 
      where: { id, deletedAt: IsNull() } as FindOptionsWhere<Service>,
      relations: this.defaultRelations.services
    };

    const entity = await this.serviceRepository.findOne(options);
    if (!entity) {
      throw new Error(`Service with ID ${id} not found`);
    }
    return entity;
  }

  async updateService(id: string, updateServiceDto: UpdateServiceDto): Promise<Service> {
    const service = await this.findOneService(id);
    return this.serviceRepository.save({ ...service, ...updateServiceDto });
  }

  async deleteService(id: string): Promise<{ message: string }> {
    await this.findOneService(id);
    await this.serviceRepository.softDelete(id);
    return { message: `Service with ID ${id} has been soft deleted` };
  }

  async restoreService(id: string): Promise<Service> {
    await this.serviceRepository.restore(id);
    return this.findOneService(id);
  }

  async getAgentStatistics() {
    const [total, verified, unverified] = await Promise.all([
      this.agentRepository.count({ where: { deletedAt: IsNull() } }),
      this.agentRepository.count({ where: { isVerified: true, deletedAt: IsNull() } }),
      this.agentRepository.count({ where: { isVerified: false, deletedAt: IsNull() } }),
    ]);

    return {
      total,
      verified,
      unverified,
      verificationRate: total > 0 ? (verified / total) * 100 : 0,
    };
  }

  async getServiceStatistics() {
    const counts = await Promise.all([
      this.serviceRepository.count({ where: { deletedAt: IsNull() } }),
      this.serviceRepository.count({ where: { status: ServiceStatus.PENDING, deletedAt: IsNull() } }),
      this.serviceRepository.count({ where: { status: ServiceStatus.IN_PROGRESS, deletedAt: IsNull() } }),
      this.serviceRepository.count({ where: { status: ServiceStatus.COMPLETED, deletedAt: IsNull() } }),
      this.serviceRepository.count({ where: { status: ServiceStatus.CANCELLED, deletedAt: IsNull() } }),
    ]);

    const [total, pending, inProgress, completed, cancelled] = counts;
    
    return {
      total,
      pending,
      inProgress,
      completed,
      cancelled,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
    };
  }

  
  async searchAgents(
    searchTerm: string,
    paginationDto: PaginationDto
  ): Promise<IPaginationResponse<Agent>> {
    const { page = 1, limit = 10 } = paginationDto;
    const pageNum = Number(page);
    const limitNum = Number(limit);
  
    const whereOptions = searchTerm 
      ? [
          { firstName: ILike(`%${searchTerm}%`), deletedAt: IsNull() },
          { lastName: ILike(`%${searchTerm}%`), deletedAt: IsNull() },
          { email: ILike(`%${searchTerm}%`), deletedAt: IsNull() },
          { mobileNumber: ILike(`%${searchTerm}%`), deletedAt: IsNull() },
        ]
      : { deletedAt: IsNull() };
  
    const [items, total] = await this.agentRepository.findAndCount({
      where: whereOptions,
      relations: this.defaultRelations.agents,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    });
  
    return this.buildPaginationResponse(items, total, pageNum, limitNum);
  }

  async searchServices(
    query: string, 
    paginationDto: PaginationDto
  ): Promise<IPaginationResponse<Service>> {
    const { page = 1, limit = 10 } = paginationDto;
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const [items, total] = await this.serviceRepository.findAndCount({
      where: query ? [
        { description: ILike(`%${query}%`), deletedAt: IsNull() },
        { address: ILike(`%${query}%`), deletedAt: IsNull() },
        { mobileNumber: ILike(`%${query}%`), deletedAt: IsNull() },
      ] : { deletedAt: IsNull() },
      relations: this.defaultRelations.services,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    });

    return this.buildPaginationResponse(items, total, pageNum, limitNum);
  }

  async findDeletedAgents(): Promise<Agent[]> {
    return this.agentRepository.find({ 
      where: { deletedAt: Not(IsNull()) },
      withDeleted: true 
    });
  }

  async findDeletedServices(): Promise<Service[]> {
    return this.serviceRepository.find({ 
      where: { deletedAt: Not(IsNull()) },
      withDeleted: true 
    });
  }

  private buildPaginationResponse<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
  ): IPaginationResponse<T> {
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}