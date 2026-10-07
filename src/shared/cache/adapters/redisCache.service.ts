import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { REDIS_CLIENT } from '../constants';
import type { ForCache } from '../ports/forCache.port';

@Injectable()
export class RedisCacheService implements ForCache {
	private readonly logger = new Logger(RedisCacheService.name);

	constructor(
		@Inject(REDIS_CLIENT)
		private readonly redis: Redis,
	) {}

	async get<T = unknown>(key: string): Promise<T | null> {
		try {
			const raw = await this.redis.get(key);
			if (raw === null || raw === undefined) {
				return null;
			}

			try {
				return JSON.parse(raw) as T;
			} catch {
				return raw as unknown as T;
			}
		} catch (error) {
			this.logger.error(`Error al obtener clave de caché [${key}]:`, error);
			return null;
		}
	}

	async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
		try {
			const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

			if (ttlSeconds && ttlSeconds > 0) {
				await this.redis.set(key, stringValue, 'EX', ttlSeconds);
			} else {
				await this.redis.set(key, stringValue);
			}
		} catch (error) {
			this.logger.error(`Error al guardar clave en caché [${key}]:`, error);
		}
	}

	async del(key: string): Promise<void> {
		try {
			await this.redis.del(key);
		} catch (error) {
			this.logger.error(`Error al eliminar clave de caché [${key}]:`, error);
		}
	}

	async exists(key: string): Promise<boolean> {
		try {
			const count = await this.redis.exists(key);
			return count > 0;
		} catch (error) {
			this.logger.error(`Error al verificar existencia de [${key}]:`, error);
			return false;
		}
	}

	async ttl(key: string): Promise<number> {
		try {
			return await this.redis.ttl(key);
		} catch (error) {
			this.logger.error(`Error al obtener TTL de [${key}]:`, error);
			return -2;
		}
	}
}
