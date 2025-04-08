import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Link } from './entities/link.entity';

@Injectable()
export class LinkService {
  constructor(
    @InjectRepository(Link)
    private readonly linkRepository: Repository<Link>,
  ) {}

  async createLink(
    agentId: string,
    serviceId: string,
    expirationMinutes: number,
  ): Promise<Link> {
    const expirationTime = new Date();
    expirationTime.setMinutes(expirationTime.getMinutes() + expirationMinutes);

    const link = this.linkRepository.create({
      agentId,
      serviceId,
      expirationTime,
    });
    return this.linkRepository.save(link);
  }

  async findOne(id: string): Promise<Link> {
    const link = await this.linkRepository.findOne({ where: { id } });
    if (!link) {
      throw new NotFoundException(`Link with ID ${id} not found`);
    }
    return link;
  }

  async update(id: string, updateData: Partial<Link>): Promise<Link> {
    const link = await this.findOne(id);
    Object.assign(link, updateData);
    return this.linkRepository.save(link);
  }
}