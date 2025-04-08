import {
  IsOptional,
  IsString,
  IsNumber,
} from 'class-validator';

export class AdditionalAddressDto {
  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  zipCode?: string;

  
  @IsString()
  @IsOptional()
  stateAbbreviation?: string


  @IsString()
  @IsOptional()
  country?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;
}
