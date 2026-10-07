import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AdminRoles, type User } from '../../../users/app/entities/user.entity';
import { ROLES_KEY } from '../../decorators/roles.decorator';

export interface RequestWithUser {
	user?: Partial<User> & {
		role?: AdminRoles | string;
		roles?: (AdminRoles | string)[];
	};
}

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.getAllAndOverride<(AdminRoles | string)[]>(
			ROLES_KEY,
			[context.getHandler(), context.getClass()],
		);

		// If no roles are specified, access is public / unrestricted by role
		if (!requiredRoles || requiredRoles.length === 0) {
			return true;
		}

		const request = context.switchToHttp().getRequest<RequestWithUser>();
		const user = request.user;

		if (!user) {
			throw new ForbiddenException(
				'Usuario no autenticado o no encontrado en la petición',
			);
		}

		// Dynamically collect all roles assigned to the user (single role or array of roles)
		const userRoles: (AdminRoles | string)[] = [];
		if (user.role) {
			userRoles.push(user.role);
		}
		if (Array.isArray(user.roles)) {
			userRoles.push(...user.roles);
		}

		if (userRoles.length === 0) {
			throw new ForbiddenException(
				'El usuario no tiene ningún rol asignado para realizar esta acción',
			);
		}

		// Dynamic matching: check if user has at least one of the required roles
		// Normalizing to string uppercase to be resilient against enum/string variations
		const normalizedUserRoles = new Set(
			userRoles.map(r => String(r).toUpperCase().trim()),
		);
		const hasRequiredRole = requiredRoles.some(requiredRole =>
			normalizedUserRoles.has(String(requiredRole).toUpperCase().trim()),
		);

		if (!hasRequiredRole) {
			throw new ForbiddenException(
				'No tienes los permisos necesarios para realizar esta acción',
			);
		}

		return true;
	}
}
