import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Length,
  IsEmail,
  MinLength,
  ValidateNested,
  Min,
} from 'class-validator';
import { Role } from '../../common/enum/roles.enum';
import { WorkAreaDto } from '../../common/interfaces/workArea';
import { Transform, Type } from 'class-transformer';
import { AdditionalAddressDto } from './additional-address.dto';
import { AgentAvailabilityDto } from './agent-availability.dto';

export class InsuranceDetailsDto {
  @IsString()
  @IsOptional()
  insured_name?: string;

  @IsString()
  @IsOptional()
  policy_number?: string;

  @IsString()
  @IsOptional()
  insurance_provider?: string;

  @IsString()
  @IsOptional()
  policy_type?: string;

  @IsString()
  @IsOptional()
  effective_date?: string;

  @IsString()
  @IsOptional()
  expiration_date?: string;
}

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  zipCode: string;

  @IsString()
  @IsNotEmpty()
  mobileNumber: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @Length(2, 2)
  @IsOptional()
  stateAbbreviation?: string;

  @IsNumber()
  @Min(0)
  workRadius: number;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsOptional()
  @Transform(({ value }) => (value ? parseFloat(value) : null))
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Transform(({ value }) => (value ? parseFloat(value) : null))
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @Type(() => AdditionalAddressDto)
  additionalAddresses?: AdditionalAddressDto[];

  @Type(() => AgentAvailabilityDto)
  @IsNotEmpty()
  agentAvailable?: AgentAvailabilityDto[];

  @IsNotEmpty()
  @IsOptional()
  driverLicenseFile?: any;

  @IsNotEmpty()
  @IsOptional()
  insuranceFile?: any;

  @IsNotEmpty()
  @IsOptional()
  electricCertificateFile?: any;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isVerified?: boolean;

  @IsEnum(Role)
  @IsOptional()
  role: Role;

  @IsOptional()
  @ValidateNested()
  @Type(() => InsuranceDetailsDto)
  insuranceDetails?: InsuranceDetailsDto;

  @IsBoolean()
  @IsNotEmpty()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  termsAccepted: boolean;

  @IsString()
  @IsOptional()
  verificationId?: string;

  @IsOptional()
  @Type(() => WorkAreaDto)
  workAreas?: WorkAreaDto[];

  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @IsOptional()
  licenseExpirationDate?: Date;

  @IsOptional()
  @IsString()
  licenseVerificationSessionId?: string;

  @IsString()
  @IsOptional()
  licenseVerificationStatus?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isLicenseVerified?: boolean;
}
