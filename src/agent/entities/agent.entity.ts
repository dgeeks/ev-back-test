import { Service } from '../../services/entities/service.entity';
import { Role } from '../../common/enum/roles.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  DeleteDateColumn,
} from 'typeorm';
import { Link } from '../../links/entities/link.entity';
import { File } from '../../file/file.entity';
import { DocumentType } from '../../common/enum/documentType.enum';
import { WeekDay } from '../../common/enum/dayOfWeek';
import { AvailabilityStatus } from '../../common/enum/availabilityStatus.enum';

@Entity()
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  firstName: string;

  @Column({ nullable: false })
  lastName: string;

  @Column({ nullable: false, unique: true })
  @Index()
  email: string;

  @Column({ select: false })
  password: string;

  @Column({ nullable: false })
  address: string;

  @Column({ nullable: false })
  mobileNumber: string;

  @Column({ nullable: false })
  @Index()
  zipCode: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true, length: 2 })
  @Index()
  stateAbbreviation: string;

  @Column({ nullable: false })
  @Index()
  country: string;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  longitude: number;

  @Column({ nullable: true, default: false })
  isVerified: boolean;

  @Column({ type: 'boolean', nullable: false, default: false })
  termsAccepted: boolean;

  @Column({ type: 'enum', enum: Role, default: Role.AGENT, nullable: true })
  role: Role;

  @Column({ type: 'boolean', nullable: true, default: false })
  isAvailable: boolean;

  @Column({ type: 'json', nullable: true })
  insuranceDetails: {
    insured_name?: string;
    policy_number?: string;
    insurance_provider?: string;
    policy_type?: string;
    effective_date?: string;
    expiration_date?: string;
  };

  @Column({ type: 'json', nullable: true })
  electricCertificateDetails: {
    full_name?: string;
    license_type?: string;
    expiration_date?: string;
    city?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  additionalAddresses: {
    address?: string;
    label?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    stateAbbreviation?: string;
  }[];

  @Column({ type: 'jsonb', })
  agentAvailable: {
    day: WeekDay;
    startTime: string;
    endTime: string;
    status: AvailabilityStatus;
  }[];

  @Column({ nullable: true })
  verificationId: string;

  @Column({ nullable: true })
  licenseNumber: string;

  @Column({ nullable: true })
  licenseExpirationDate?: Date;

  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'declined', 'expired'],
    default: 'pending',
    nullable: true,
  })
  licenseVerificationStatus: string;

  @Column({ nullable: true })
  licenseVerificationSessionId: string;

  @Column({ default: false })
  isLicenseVerified: boolean;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: false,
    default: 0,
  })
  workRadius: number;

  @Column({ type: 'json', nullable: true })
  workAreas: {
    id?: string;
    name: string;
    type: 'polygon' | 'circle';
    coordinates?: { lat: number; lng: number }[];
    radius?: number;
    center?: { lat: number; lng: number };
    color?: string;
    notes?: string;
  }[];

  @Column({ type: 'json', nullable: true })
  documents: {
    id?: string;
    type: DocumentType;
    url: string;
    originalName?: string;
    uploadedAt: Date;
    expirationDate?: Date;
    isVerified?: boolean;
    mimeType?: string;
  }[];

  @Column({ type: 'boolean', default: false, nullable: true })
  driverLicenseVerified: boolean;

  @Column({ type: 'boolean', default: false, nullable: true })
  insuranceVerified: boolean;

  @Column({ type: 'boolean', default: false, nullable: true })
  electricCertificateVerified: boolean;

  @Column({ type: 'boolean', default: false, nullable: true })
  isDocumentFullyVerified: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;

  @OneToMany(() => Service, (service) => service.agent)
  services: Service[];

  @OneToMany(() => Link, (link) => link.agent)
  links: Link[];

  @OneToMany(() => File, (file) => file.agent)
  files: File[];
}
