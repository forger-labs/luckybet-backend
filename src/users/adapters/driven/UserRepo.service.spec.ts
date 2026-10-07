import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource, Repository } from 'typeorm';

import {
	buildPostgresContainer,
	stopTestContainer,
} from '../../../../test/shared/buildPostgresCont';
import { UserWithoutPassword } from '../../app/dto/user.schema';
import { AdminRoles, User } from '../../app/entities/user.entity';
import { UserRepoService } from './UserRepo.service';

describe('UserRepoService (integration — PostgreSQL real)', () => {
	let pgContainer: StartedPostgreSqlContainer;
	let testDataSource: DataSource;
	let userRepo: Repository<User>;
	let service: UserRepoService;

	// ── Setup ──────────────────────────────────────────────────────

	beforeAll(async () => {
		const [dataSource, container] = await buildPostgresContainer();
		testDataSource = dataSource;
		pgContainer = container;

		userRepo = testDataSource.getRepository(User);
		service = new UserRepoService(userRepo);
	}, 120_000);

	afterAll(async () => {
		await stopTestContainer(testDataSource, pgContainer);
	}, 60_000);

	beforeEach(async () => {
		// Use DELETE instead of TRUNCATE (Repository.clear): missions.created_by
		// references admin_users, so a plain TRUNCATE fails with an FK error.
		await userRepo.createQueryBuilder().delete().execute();
	});

	// ── createUser ─────────────────────────────────────────────────

	describe('createUser', () => {
		it('debería crear un usuario y devolverlo sin password', async () => {
			const input = {
				username: 'test_user',
				password: 'secret123',
				role: AdminRoles.REVIEWER,
				isActive: true,
			};

			const result = await service.createUser(input);

			expect(result).toMatchObject({
				username: 'test_user',
				role: AdminRoles.REVIEWER,
				isActive: true,
			});
			expect(result.id).toBeDefined();
			expect((result as Record<string, unknown>).password).toBeUndefined();
		});

		it('debería crear un usuario con isActive false si se pasa explícitamente', async () => {
			const input = {
				username: 'inactive_user',
				password: 'pass123',
				role: AdminRoles.SUPER_ADMIN,
				isActive: false,
			};

			const result = await service.createUser(input);

			expect(result.isActive).toBe(false);
		});
	});

	// ── findByUnique ────────────────────────────────────────────────

	describe('findByUnique', () => {
		let createdUser: Awaited<ReturnType<typeof service.createUser>>;

		beforeEach(async () => {
			createdUser = await service.createUser({
				username: 'findme',
				password: 'abc123',
				role: AdminRoles.REVIEWER,
				isActive: true,
			});
		});

		it('debería encontrar por id', async () => {
			const result = await service.findByUnique({ id: createdUser.id });

			expect(result).not.toBeNull();
			expect(result?.username).toBe('findme');
		});

		it('debería encontrar por username', async () => {
			const result = await service.findByUnique({ username: 'findme' });

			expect(result).not.toBeNull();
			expect(result?.id).toBe(createdUser.id);
		});

		it('debería devolver null cuando el id no existe', async () => {
			const result = await service.findByUnique({ id: 99_999 });

			expect(result).toBeNull();
		});

		it('debería devolver null cuando el username no existe', async () => {
			const result = await service.findByUnique({
				username: 'no_existe_999',
			});

			expect(result).toBeNull();
		});

		it('no debería incluir password en el resultado', async () => {
			const result = await service.findByUnique({ id: createdUser.id });

			expect(result).not.toBeNull();

			expect(result).not.toHaveProperty('password');
		});
	});

	// -- findToAuth -------------------------------------------------

	describe('findToAuth', () => {
		let createdUser: Awaited<ReturnType<typeof service.createUser>>;

		beforeEach(async () => {
			createdUser = await service.createUser({
				username: 'findme',
				password: 'abc123',
				role: AdminRoles.REVIEWER,
				isActive: true,
			});
		});

		it('debería encontrar por id', async () => {
			const result = await service.findToAuth({ id: createdUser.id });

			expect(result).not.toBeNull();
			expect(result?.id).toBe(createdUser.id);
		});

		it('debería encontrar por username', async () => {
			const result = await service.findToAuth({ username: 'findme' });

			expect(result).not.toBeNull();
			expect(result?.id).toBe(createdUser.id);
		});

		it('debería devolver null cuando el id no existe', async () => {
			const result = await service.findToAuth({ id: 99_999 });

			expect(result).toBeNull();
		});

		it('debería devolver null cuando el username no existe', async () => {
			const result = await service.findToAuth({
				username: 'no_existe_999',
			});

			expect(result).toBeNull();
		});
	});

	// ── getUsers ───────────────────────────────────────────────────

	describe('getUsers', () => {
		const usersLength = 5;
		beforeEach(async () => {
			const users: Promise<UserWithoutPassword>[] = [];
			for (let i = 0; i < usersLength; i++) {
				users.push(
					service.createUser({
						username: `user_${i}`,
						password: 'pass123',
						role: AdminRoles.REVIEWER,
						isActive: true,
					}),
				);
			}
			await Promise.all(users);
		});

		it('debería devolver todos los usuarios con paginación por defecto', async () => {
			const [users, total] = await service.getUsers({});

			expect(users).toHaveLength(usersLength);
			expect(total).toBe(usersLength);
		});

		it('debería respetar limit', async () => {
			const [users, total] = await service.getUsers({ take: 2 });

			expect(users).toHaveLength(2);
			expect(total).toBe(usersLength);
		});

		it('debería respetar offset', async () => {
			const [users, total] = await service.getUsers({ take: 2, skip: 2 });

			expect(users).toHaveLength(2);
			expect(total).toBe(usersLength);
		});

		it('no debería incluir password en ningún usuario de la lista', async () => {
			const [users] = await service.getUsers({});

			for (const user of users) {
				expect(user).not.toHaveProperty('password');
			}
		});
	});

	// ── updateUserById ─────────────────────────────────────────────

	describe('updateUserById', () => {
		let createdUser: UserWithoutPassword;

		beforeEach(async () => {
			createdUser = await service.createUser({
				username: 'updatable',
				password: 'oldpass',
				role: AdminRoles.REVIEWER,
				isActive: true,
			});
		});

		it('debería actualizar el rol', async () => {
			const result = await service.updateUserById(createdUser.id, {
				role: AdminRoles.SUPER_ADMIN,
			});

			expect(result).not.toBeNull();
			expect(result?.role).toBe(AdminRoles.SUPER_ADMIN);
		});

		it('debería actualizar el username', async () => {
			const result = await service.updateUserById(createdUser.id, {
				username: 'updated_name',
			});

			expect(result).not.toBeNull();
			expect(result?.username).toBe('updated_name');
		});

		it('debería devolver null si el usuario no existe', async () => {
			const result = await service.updateUserById(999_999, {
				role: AdminRoles.SUPER_ADMIN,
			});

			expect(result).toBeNull();
		});

		it('no debería exponer el password tras la actualización', async () => {
			const result = await service.updateUserById(createdUser.id, {
				username: 'safe_user',
			});

			expect(result).not.toBeNull();
			expect((result as Record<string, unknown>).password).toBeUndefined();
		});
	});
});
