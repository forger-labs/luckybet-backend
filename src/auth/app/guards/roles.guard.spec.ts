import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AdminRoles, type User } from '@/src/users/app/entities/user.entity';
import { type RequestWithUser, RolesGuard } from '../guards/roles.guard';

describe('RolesGuard', () => {
	let guard: RolesGuard;
	let reflector: Reflector;

	beforeEach(() => {
		reflector = new Reflector();
		guard = new RolesGuard(reflector);
	});

	const createMockContext = (user?: RequestWithUser['user']): ExecutionContext => {
		return {
			getHandler: () => jest.fn(),
			getClass: () => jest.fn(),
			switchToHttp: () => ({
				getRequest: () => ({ user }),
			}),
		} as unknown as ExecutionContext;
	};

	it('should allow access when no roles are required on the route', () => {
		jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
		const context = createMockContext();

		expect(guard.canActivate(context)).toBe(true);
	});

	it('should throw ForbiddenException if required roles exist but no user is in request', () => {
		jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([AdminRoles.SUPER_ADMIN]);
		const context = createMockContext(undefined);

		expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
	});

	it('should throw ForbiddenException if user has no roles assigned', () => {
		jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([AdminRoles.SUPER_ADMIN]);
		const context = createMockContext({
			id: 1,
			username: 'noroles',
		});

		expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
	});

	it('should throw ForbiddenException if user role does not match any required role', () => {
		jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([AdminRoles.SUPER_ADMIN]);
		const context = createMockContext({
			id: 1,
			username: 'reviewer_user',
			role: AdminRoles.REVIEWER,
		});

		expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
	});

	it('should allow access if user has single matching role', () => {
		jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([AdminRoles.SUPER_ADMIN]);
		const context = createMockContext({
			id: 1,
			username: 'superadmin',
			role: AdminRoles.SUPER_ADMIN,
		});

		expect(guard.canActivate(context)).toBe(true);
	});

	it('should dynamically allow access when user matches one of multiple required roles', () => {
		jest
			.spyOn(reflector, 'getAllAndOverride')
			.mockReturnValue([AdminRoles.SUPER_ADMIN, AdminRoles.REVIEWER]);
		const context = createMockContext({
			id: 2,
			username: 'reviewer',
			role: AdminRoles.REVIEWER,
		});

		expect(guard.canActivate(context)).toBe(true);
	});

	it('should dynamically check user roles array when present', () => {
		jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([AdminRoles.SUPER_ADMIN]);
		const context = createMockContext({
			id: 3,
			username: 'multi',
			roles: [AdminRoles.REVIEWER, AdminRoles.SUPER_ADMIN],
		});

		expect(guard.canActivate(context)).toBe(true);
	});

	it('should handle case-insensitive string matching resiliently', () => {
		jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['super_admin']);
		const context = createMockContext({
			id: 4,
			username: 'superadmin',
			role: AdminRoles.SUPER_ADMIN,
		});

		expect(guard.canActivate(context)).toBe(true);
	});
});
