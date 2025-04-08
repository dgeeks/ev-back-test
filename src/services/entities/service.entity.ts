import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  OneToMany,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { ServiceStatus } from '../enums/service-status.enum';
import { ServiceType } from '../enums/service-type.enum';
import { Agent } from '../../agent/entities/agent.entity';
import { LeadSource } from '../enums/service-leadSource.enum';
import { PaymentStatus } from '../enums/service-PaymentStatus.enum';
import { Role } from '../../common/enum/roles.enum';
import { Link } from '../../links/entities/link.entity';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  mobileNumber: string;

  @Column({ nullable: true, length: 2 })
  @Index()
  stateAbbreviation: string;

  @Column({ nullable: false })
  @Index()
  country: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  zipCode: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'enum', enum: Role, default: Role.CUSTOMER, nullable: true })
  role: Role;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  longitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  latitude: number;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: false })
  address: string;

  @Column({
    type: 'enum',
    enum: ServiceStatus,
    default: ServiceStatus.PENDING,
  })
  status: ServiceStatus;

  @Column({
    type: 'enum',
    enum: ServiceType,
    default: ServiceType.INSTALLATION,
  })
  type: ServiceType;

  @ManyToOne(() => Agent, (agent) => agent.services)
  @JoinColumn({ name: 'agentId' })
  agent: Agent;

  @Column({ nullable: true })
  agentId: string;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  requestedAt: Date;

  @Column({
    type: 'enum',
    enum: LeadSource,
    default: LeadSource.CUSTOMER,
    nullable: true,
  })
  leadSource: LeadSource;

  @Column({ type: 'varchar', length: 255, nullable: true })
  feedback: string;

  @Column({ type: 'boolean', default: false, nullable: true })
  isPaymentProcessed: boolean;

  @Column({ type: 'json', nullable: true })
  userAvailable: { startTime: Date; endTime: Date }[];

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @Column({ type: 'boolean', default: false, nullable: true })
  isJobCompleted: boolean;

  @Column({ type: 'boolean', default: false, nullable: true })
  isJobCancelled: boolean;

  @Column({ type: 'boolean', default: false, nullable: true })
  isJobInProgress: boolean;

  @Column({ type: 'boolean', default: false, nullable: true })
  hasEVChargerInstalled: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  comments: string;

  @OneToMany(() => Link, (link) => link.service)
  links: Link[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;
}
