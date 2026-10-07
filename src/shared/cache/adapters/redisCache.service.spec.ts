import { Test, TestingModule } from '@nestjs/testing';

import { REDIS_CLIENT } from '../constants';
import { RedisCacheService } from './redisCache.service';

describe('RedisCacheService', () => {
	let service: RedisCacheService;
	let mockRedis: {
		get: jest.Mock;
		set: jest.Mock;
		del: jest.Mock;
		exists: jest.Mock;
		ttl: jest.Mock;
	};

	beforeEach(async () => {
		mockRedis = {
			get: jest.fn(),
			set: jest.fn(),
			del: jest.fn(),
			exists: jest.fn(),
			ttl: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				RedisCacheService,
				{
					provide: REDIS_CLIENT,
					useValue: mockRedis,
				},
			],
		}).compile();

		service = module.get<RedisCacheService>(RedisCacheService);
	});

	describe('get', () => {
		it('debe devolver null si la clave no existe', async () => {
			mockRedis.get.mockResolvedValue(null);
			const result = await service.get('no_key');
			expect(result).toBeNull();
			expect(mockRedis.get).toHaveBeenCalledWith('no_key');
		});

		it('debe parsear y devolver objeto JSON correctamente', async () => {
			const data = { token: 'abc-123', balance: 5000 };
			mockRedis.get.mockResolvedValue(JSON.stringify(data));

			const result = await service.get('some_key');
			expect(result).toEqual(data);
		});

		it('debe devolver string si el contenido no es JSON válido', async () => {
			mockRedis.get.mockResolvedValue('plain_string_value');

			const result = await service.get('string_key');
			expect(result).toBe('plain_string_value');
		});

		it('debe retornar null y no lanzar excepción ante error de Redis', async () => {
			mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

			const result = await service.get('failing_key');
			expect(result).toBeNull();
		});
	});

	describe('set', () => {
		it('debe guardar un valor con TTL', async () => {
			mockRedis.set.mockResolvedValue('OK');

			await service.set('session_key', 'phpsessid_123', 240);
			expect(mockRedis.set).toHaveBeenCalledWith(
				'session_key',
				'phpsessid_123',
				'EX',
				240,
			);
		});

		it('debe serializar objetos a JSON al guardar', async () => {
			mockRedis.set.mockResolvedValue('OK');
			const obj = { id: 1, name: 'Lucky' };

			await service.set('obj_key', obj);
			expect(mockRedis.set).toHaveBeenCalledWith('obj_key', JSON.stringify(obj));
		});
	});

	describe('del', () => {
		it('debe llamar a redis.del con la clave dada', async () => {
			mockRedis.del.mockResolvedValue(1);

			await service.del('key_to_delete');
			expect(mockRedis.del).toHaveBeenCalledWith('key_to_delete');
		});
	});

	describe('exists', () => {
		it('debe devolver true si la clave existe', async () => {
			mockRedis.exists.mockResolvedValue(1);

			const exists = await service.exists('active_key');
			expect(exists).toBe(true);
		});

		it('debe devolver false si la clave no existe', async () => {
			mockRedis.exists.mockResolvedValue(0);

			const exists = await service.exists('missing_key');
			expect(exists).toBe(false);
		});
	});

	describe('ttl', () => {
		it('debe devolver el TTL en segundos devuelto por Redis', async () => {
			mockRedis.ttl.mockResolvedValue(180);

			const remaining = await service.ttl('some_key');
			expect(remaining).toBe(180);
		});
	});
});
