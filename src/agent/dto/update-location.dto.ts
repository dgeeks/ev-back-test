import { IsString, IsNumber } from 'class-validator';

export class UpdateLocationDto {
  @IsString()
  agentId: string;

  @IsNumber({ maxDecimalPlaces: 6 })
  latitude: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  longitude: number;
}
