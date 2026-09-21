import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZodValidationPipe } from 'nestjs-zod';

import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MisionesModule } from './misiones/misiones.module';
import { buildTypeOrmOptionsFromConfig } from './shared/database/databaseOptions';
import { RequestLoggerInterceptor } from './shared/interceptors/requestLogger.interceptor';
import { LoggerModule } from './shared/logger/logger.module';
import { StorageModule } from './shared/storage/storage.module';
import { UsersModule } from './users/users.module';
import { LevelsService } from './levels/levels.service';
import { LevelsModule } from './levels/levels.module';

@Module({
	imports: [
		ConfigModule.forRoot({ cache: true, isGlobal: true }),
		TypeOrmModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => buildTypeOrmOptionsFromConfig(config),
		}),
		HealthModule,
		UsersModule,
		LoggerModule,
		StorageModule,
		AuthModule,
		MisionesModule,
		LevelsModule,
	],
	providers: [
		{ provide: APP_INTERCEPTOR, useClass: RequestLoggerInterceptor },
		LevelsService,
		// { provide: APP_PIPE, useClass: ZodValidationPipe },
	],
})
export class AppModule {}
