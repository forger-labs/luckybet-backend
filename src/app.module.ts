import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZodValidationPipe } from 'nestjs-zod';

import { AuthModule } from './auth/auth.module';
import { ChestsModule } from './chests/chests.module';
import { HealthModule } from './health/health.module';
import { LevelRewardsModule } from './levelRewards/levelRewards.module';
import { LevelsModule } from './levels/levels.module';
import { MisionesModule } from './misiones/misiones.module';
import { PanelModule } from './panelApi/panel.module';
import { PlayerChestsModule } from './playerChests/playerChests.module';
import { PlayersModule } from './players/players.module';
import { RewardsModule } from './rewards/rewards.module';
import { RoomsModule } from './rooms/rooms.module';
import { CacheModule } from './shared/cache/cache.module';
import { buildTypeOrmOptionsFromConfig } from './shared/database/databaseOptions';
import { RequestLoggerInterceptor } from './shared/interceptors/requestLogger.interceptor';
import { LoggerModule } from './shared/logger/logger.module';
import { StorageModule } from './shared/storage/storage.module';
import { UsersModule } from './users/users.module';

@Module({
	imports: [
		ConfigModule.forRoot({ cache: true, isGlobal: true }),
		TypeOrmModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => buildTypeOrmOptionsFromConfig(config),
		}),
		HealthModule,
		AuthModule,
		UsersModule,
		LoggerModule,
		StorageModule,
		CacheModule,
		PanelModule,
		RoomsModule,
		PlayersModule,
		MisionesModule,
		RewardsModule,
		ChestsModule,
		PlayerChestsModule,
		LevelsModule,
		LevelRewardsModule,
	],
	providers: [
		{ provide: APP_INTERCEPTOR, useClass: RequestLoggerInterceptor },
		{ provide: APP_PIPE, useClass: ZodValidationPipe },
	],
})
export class AppModule {}
