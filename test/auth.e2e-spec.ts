import cookie from '@fastify/cookie';
import { HttpStatus } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';

import { AuthModule } from '../src/auth/auth.module';
import {
	DEFAULT_ERROR_MESSAGES,
	HttpErrorsException,
} from '../src/shared/exceptions/httpErrors.exception';
import { TypeORMErrorsException } from '../src/shared/exceptions/typeOrmErrors.exception';
import { validationUserMessages } from '../src/users/app/dto/user.schema';
import { AdminRoles, User } from '../src/users/app/entities/user.entity';
import { UsersModule } from '../src/users/users.module';
import { buildPostgresContainer, stopTestContainer } from './shared/buildPostgresCont';

function getJtwToken(headers: Record<string, string | string[]>) {
	const cookies = headers['set-cookie'];

	let accessToken: string | undefined;

	if (Array.isArray(cookies)) {
		accessToken = cookies
			.find((cookie: string) => cookie.includes('accessToken'))
			?.split(';')
			.find((val: string) => val.includes('accessToken'));
	} else if (cookies) {
		accessToken = cookies.split(';').find((val: string) => val.includes('accessToken'));
	}

	expect(accessToken).not.toBeUndefined();

	const jwtToken = accessToken?.split('=').find(val => !val.includes('accessToken'));
	expect(jwtToken).not.toBeUndefined();

	return jwtToken;
}

describe('Auth end to end tests', () => {
	let pgContainer: StartedPostgreSqlContainer;
	let dataSource: DataSource;
	let httpServer: ReturnType<typeof app.getHttpServer>;
	let app: NestFastifyApplication;
	let userRepo: Repository<User>;
	let jwtService: JwtService;
	let user1: User;

	const userPassword = '1234567';

	beforeAll(async () => {
		const [ds, container, options] = await buildPostgresContainer();
		dataSource = ds;
		pgContainer = container;
		userRepo = dataSource.getRepository(User);

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [
				ConfigModule.forRoot({ cache: true, isGlobal: true }),
				TypeOrmModule.forRoot(options),
				UsersModule,
				AuthModule,
			],
		}).compile();

		app = moduleFixture.createNestApplication<NestFastifyApplication>(
			new FastifyAdapter(),
		);
		await app.register(cookie);

		app.useGlobalPipes(new ZodValidationPipe());

		app.useGlobalFilters(new HttpErrorsException());
		app.useGlobalFilters(new TypeORMErrorsException());

		await app.init();
		await app.getHttpAdapter().getInstance().ready();

		httpServer = app.getHttpServer();

		const configService = app.get(ConfigService);
		jwtService = new JwtService({
			secret: configService.getOrThrow<string>('JWT_SECRET'),
		});
	}, 120_000);

	afterAll(async () => {
		await stopTestContainer(dataSource, pgContainer);
	});

	beforeEach(async () => {
		user1 = userRepo.create({
			username: 'user1',
			password: userPassword,
			role: AdminRoles.REVIEWER,
			isActive: true,
		});

		await Promise.all([userRepo.save(user1)]);
	}, 120_000);

	afterEach(async () => {
		// DELETE instead of TRUNCATE (Repository.clear): missions.created_by
		// references admin_users, so a plain TRUNCATE fails with an FK error.
		await userRepo.createQueryBuilder().delete().execute();
	});

	describe('POST /auth/login', () => {
		it('/auth/login 200 OK', async () => {
			const result = await request(httpServer)
				.post('/auth/login')
				.send({ username: user1.username, password: userPassword })
				.expect(HttpStatus.OK);

			const jwtToken = getJtwToken(result.headers);

			// biome-ignore lint/style/noNonNullAssertion: we test before that is variable isn't undefined
			const decoded = jwtService.decode(jwtToken!);

			expect(decoded).toMatchObject({
				id: user1.id,
				username: user1.username,
			});

			expect(result.body).toStrictEqual({
				status: true,
				message: 'Inició sesión exitosamente',
				data: {
					accessToken: jwtToken,
				},
			});
		});

		it('/auth/login 400 Bad Request', async () => {
			const expectedErrors = [
				validationUserMessages.username.min,
				validationUserMessages.password.min,
			];

			const response = await request(httpServer)
				.post('/auth/login')
				.send({ username: 'as', password: '567' })
				.expect(HttpStatus.BAD_REQUEST);

			expect(response.body).toHaveProperty('errors');
			expect(response.body.message).toBe('Validation failed');

			for (const err of expectedErrors) {
				expect(response.body.errors).toContainEqual(err);
			}
		});

		it('/auth/login 404 Not Found', async () => {
			const response = await request(httpServer)
				.post('/auth/login')
				.send({ username: 'asdasd', password: '5673124' })
				.expect(HttpStatus.NOT_FOUND);

			expect(response.body.message).toBe(DEFAULT_ERROR_MESSAGES[HttpStatus.NOT_FOUND]);
		});
	});

	describe('POST /auth/logout', () => {
		it('/auth/logout 200 OK', async () => {
			const loginResult = await request(httpServer)
				.post('/auth/login')
				.send({ username: user1.username, password: userPassword })
				.expect(HttpStatus.OK);

			const jwtToken = getJtwToken(loginResult.headers);

			const res = await request(httpServer)
				.post('/auth/logout')
				.set('Cookie', `accessToken=${jwtToken}`)
				.send()
				.expect(HttpStatus.OK);

			// Verifica que la cookie se haya limpiado
			const setCookieHeader = res.headers['set-cookie'];
			expect(setCookieHeader).toBeDefined();

			const accessCookie = (
				Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]
			).find((c: string) => c.includes('accessToken'));
			expect(accessCookie).toMatch(/accessToken=;/);
			expect(accessCookie).toMatch(/Max-Age=0/);

			expect(res.body).toStrictEqual({
				status: true,
				message: 'Sesion cerrada exitosamente',
			});
		});

		it('/auth/logout 401 Unauthorized without token', async () => {
			const res = await request(httpServer)
				.post('/auth/logout')
				.send()
				.expect(HttpStatus.UNAUTHORIZED);

			expect(res.body).toStrictEqual({
				status: false,
				data: null,
				message: DEFAULT_ERROR_MESSAGES[HttpStatus.UNAUTHORIZED],
			});
		});

		it('/auth/logout 401 Unauthorized with invalid token', async () => {
			const res = await request(httpServer)
				.post('/auth/logout')
				.set('Cookie', 'accessToken=token-manchado-invalido')
				.send()
				.expect(HttpStatus.UNAUTHORIZED);

			expect(res.body).toStrictEqual({
				status: false,
				data: null,
				message: DEFAULT_ERROR_MESSAGES[HttpStatus.UNAUTHORIZED],
			});
		});
	});

	describe('GET /auth/me', () => {
		it('/auth/me 200 OK', async () => {
			const loginResult = await request(httpServer)
				.post('/auth/login')
				.send({ username: user1.username, password: userPassword })
				.expect(HttpStatus.OK);

			const jwtToken = getJtwToken(loginResult.headers);

			const result = await request(httpServer)
				.get('/auth/me')
				.set('Authorization', `Bearer ${jwtToken}`)
				.expect(HttpStatus.OK);

			expect(result.body).toStrictEqual({
				status: true,
				message: 'Success',
				data: {
					id: user1.id,
					username: user1.username,
					role: AdminRoles.REVIEWER,
					isActive: true,
				},
			});
		});

		it('/auth/me 401 Unauthorized without token', async () => {
			const result = await request(httpServer)
				.get('/auth/me')
				.expect(HttpStatus.UNAUTHORIZED);

			expect(result.body).toStrictEqual({
				status: false,
				data: null,
				message: DEFAULT_ERROR_MESSAGES[HttpStatus.UNAUTHORIZED],
			});
		});

		it('/auth/me 401 Unauthorized with invalid token', async () => {
			const result = await request(httpServer)
				.get('/auth/me')
				.set('Authorization', 'Bearer este-token-es-manchado')
				.expect(HttpStatus.UNAUTHORIZED);

			expect(result.body).toStrictEqual({
				status: false,
				data: null,
				message: DEFAULT_ERROR_MESSAGES[HttpStatus.UNAUTHORIZED],
			});
		});

		it('/auth/me 401 Unauthorized with expired token', async () => {
			const expiredToken = jwtService.sign(
				{ id: user1.id, username: user1.username },
				{ expiresIn: '0s' },
			);

			// Pequeña espera para asegurar la expiración
			await new Promise(resolve => setTimeout(resolve, 100));

			const result = await request(httpServer)
				.get('/auth/me')
				.set('Authorization', `Bearer ${expiredToken}`)
				.expect(HttpStatus.UNAUTHORIZED);

			expect(result.body).toStrictEqual({
				status: false,
				data: null,
				message: DEFAULT_ERROR_MESSAGES[HttpStatus.UNAUTHORIZED],
			});
		});
	});
});
