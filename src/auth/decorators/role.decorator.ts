import { SetMetadata } from '@nestjs/common';
import { Role } from '../../common/enum/roles.enum';

export const ROLES_KEY = 'rolesKey';
export const RolesDecorator = (...roles: Role[]) =>
  SetMetadata(ROLES_KEY, roles);
