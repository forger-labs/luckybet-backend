import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { CACHE_PORT } from '../shared/cache/constants';
import type { ForCache } from '../shared/cache/ports/forCache.port';
import { LevelsEntityService } from './adapters/drivens/levelsEntity.service';
import { LevelsController } from './adapters/drivers/levels.controller';
import { LEVELS_CORE_PROVIDER } from './app/constants';
import LevelsEntity from './app/entities/levels.entity';
import { LevelsCore } from './app/levelsCore';
import type { ForDatabaseLevels } from './ports/drivers/forDatabaseLevels';

@Module({
	imports: [AuthModule, TypeOrmModule.forFeature([LevelsEntity])],
	controllers: [LevelsController],
	providers: [
		LevelsEntityService,
		{
			provide: LEVELS_CORE_PROVIDER,
			useFactory: (repo: ForDatabaseLevels, cache: ForCache) =>
				new LevelsCore(repo, cache),
			inject: [LevelsEntityService, CACHE_PORT],
		},
	],
	exports: [LevelsEntityService, LEVELS_CORE_PROVIDER],
})
export class LevelsModule {}
