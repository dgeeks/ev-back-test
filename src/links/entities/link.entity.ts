import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Agent } from '../../agent/entities/agent.entity';
import { Service } from '../../services/entities/service.entity';

@Entity('links')
export class Link {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Agent, { nullable: false })
  @JoinColumn({ name: 'agentId' })
  agent: Agent;

  @ManyToOne(() => Service, { nullable: false })
  @JoinColumn({ name: 'serviceId' })
  service: Service;

  @Column()
  agentId: string;

  @Column()
  serviceId: string;

  @Column({ type: 'timestamp', nullable: false })
  expirationTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  clickedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;
}
