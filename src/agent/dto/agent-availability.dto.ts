import { WeekDay } from '../../common/enum/dayOfWeek';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AvailabilityStatus } from '../../common/enum/availabilityStatus.enum';

export class AgentAvailabilityDto {
  @IsEnum(WeekDay)
  day: WeekDay;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  endTime: string;

  @IsOptional()
  @IsEnum(AvailabilityStatus)
  status: AvailabilityStatus;
}
