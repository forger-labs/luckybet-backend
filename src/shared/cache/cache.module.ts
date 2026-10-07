import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { RedisCacheService } from './adapters/redisCache.service';
import { CACHE_PORT, REDIS_CLIENT } from './constants';

@Global()
@Module({
	providers: [
		{
			provide: REDIS_CLIENT,
			inject: [ConfigService],
			useFactory: (config: ConfigService) => {
				const host = config.get<string>('REDIS_HOST', 'localhost');
				const port = Number(config.get<number | string>('REDIS_PORT', 6379));
				const password = config.get<string>('REDIS_PASSWORD');

				return new Redis({
					host,
					port,
					password: password || undefined,
					lazyConnect: true,
					retryStrategy: (times: number) => {
						if (times > 5) {
							return null;
						}
						return Math.min(times * 100, 2000);
					},
				});
			},
		},
		{
			provide: CACHE_PORT,
			useClass: RedisCacheService,
		},
		RedisCacheService,
	],
	exports: [CACHE_PORT, RedisCacheService, REDIS_CLIENT],
})
export class CacheModule {}
