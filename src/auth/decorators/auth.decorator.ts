import { applyDecorators, UseGuards } from '@nestjs/common';
import { Role } from '../../common/enum/roles.enum';

import { RolesGuard } from '../guard/roles.guard';
import { RolesDecorator } from './role.decorator';

export function AuthDecorator(...roles: Role[]) {
  return applyDecorators(RolesDecorator(...roles), UseGuards(RolesGuard));
}
