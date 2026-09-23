import { SetMetadata } from '@nestjs/common';

import { AdminRoles } from '../../users/app/entities/user.entity';

export const ROLES_KEY = 'roles';

/**
 * Decorator to assign required roles to endpoints or controllers.
 * Accepts multiple roles (e.g. `@Roles(AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER)`
 * or `@Roles('SUPER_ADMIN')`).
 */
export const Roles = (...roles: (AdminRoles | keyof typeof AdminRoles | string)[]) =>
	SetMetadata(ROLES_KEY, roles);
