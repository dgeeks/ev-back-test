import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class DriverLicenseVerificationDto {
  @IsNotEmpty()
  @IsString()
  agentId: string;

  @IsNotEmpty()
  @IsString()
  country: string;

  @IsOptional()
  @IsString()
  state?: string;
}

export class VerificationWebhookDto {
  @IsNotEmpty()
  verification: {
    id: string;
    status: string;
    vendorData: string;
  };
}
