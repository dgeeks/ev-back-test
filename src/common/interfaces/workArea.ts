import { IsString, IsOptional, IsArray, ValidateNested, IsIn, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class CoordinatesDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

class CenterDto {
  @IsNumber()
  lat: number;  

  @IsNumber()
  lng: number;
}

export class WorkAreaDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name: string;

  @IsIn(['polygon', 'circle'])
  type: 'polygon' | 'circle';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto[];

  @IsOptional()
  @IsNumber()
  radius?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CenterDto)
  center?: CenterDto;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}