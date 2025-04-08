import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
  IsArray,
  IsDate,
  IsObject,
  IsNumber,
  IsNotEmpty,
  Length,
  ValidateNested,
} from 'class-validator';
import { ServiceStatus } from '../enums/service-status.enum';
import { ServiceType } from '../enums/service-type.enum';
import { LeadSource } from '../enums/service-leadSource.enum';
import { PaymentStatus } from '../enums/service-PaymentStatus.enum';
import { Transform, Type } from 'class-transformer';
import { Role } from '../../common/enum/roles.enum';


export class AvailabilitySlotDto {
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  startTime: Date;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  endTime: Date;
}


export class CreateServiceDto {
  @IsString()
  description: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  mobileNumber: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsString()
  @IsNotEmpty()
  address: string;

 
   @IsOptional()
   @Transform(({ value }) => (value ? parseFloat(value) : null))
   @IsNumber()
   latitude?: number;
 
   @IsOptional()
   @Transform(({ value }) => (value ? parseFloat(value) : null))
   @IsNumber()
   longitude?: number;

  @IsString()
  @Length(2, 2)
  @IsOptional()
  stateAbbreviation?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role = Role.CUSTOMER;

  @IsEnum(ServiceStatus)
  @IsOptional()
  status?: ServiceStatus = ServiceStatus.PENDING;

  @IsEnum(ServiceType)
  type: ServiceType;

  @IsUUID()
  @IsOptional()
  agentId?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  scheduledAt?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  completedAt?: Date;

  @IsOptional()
  @IsEnum(LeadSource)
  leadSource?: LeadSource;

  @IsOptional()
  @IsString()
  feedback?: string;

  @IsOptional()
  @IsBoolean()
  isPaymentProcessed?: boolean;

 @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  userAvailable?: AvailabilitySlotDto[];

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus = PaymentStatus.PENDING;

  @IsOptional()
  @IsBoolean()
  isJobCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  isJobCancelled?: boolean;

  @IsOptional()
  @IsBoolean()
  isJobInProgress?: boolean;

  @IsOptional()
  @IsBoolean()
  hasEVChargerInstalled: boolean;

  @IsOptional()
  @IsString()
  comments: string;
}
  