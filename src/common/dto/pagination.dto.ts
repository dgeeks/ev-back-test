import { IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  page: number = 1;

  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  limit: number = 10;
}

export interface IPaginationResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}


export class SearchAgentsPaginationDto {
    @IsOptional()
    @IsString()
    searchTerm: string;
  
    @IsOptional()
    @IsPositive()
    @Type(() => Number)
    page: number = 1;
  
    @IsOptional()
    @IsPositive()
    @Type(() => Number)
    limit: number = 10; 
  }