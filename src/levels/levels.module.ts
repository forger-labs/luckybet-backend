import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { CACHE_PORT } from '../shared/cache/constants';
import type { ForCache } from '../shared/cache/ports/forCache.port';
import { STORAGE_SERVICE } from '../shared/storage/storage.constants';
import type { StorageService } from '../shared/storage/storage.port';
import { LevelsEntityService } from './adapters/drivens/levelsEntity.service';
import { LevelsController } from './adapters/drivers/levels.controller';
import { LEVELS_CORE_PROVIDER, LEVELS_REPO_PROVIDER } from './app/constants';
import { LevelsEntity } from './app/entities/levels.entity';
import { LevelsCore } from './app/levelsCore';
import type { ForDatabaseLevels } from './ports/drivers/forDatabaseLevels';

@Module({
	imports: [AuthModule, TypeOrmModule.forFeature([LevelsEntity])],
	controllers: [LevelsController],
	providers: [
		LevelsEntityService,
		{
			provide: LEVELS_REPO_PROVIDER,
			useClass: LevelsEntityService,
		},
		{
			provide: LEVELS_CORE_PROVIDER,
			useFactory: (repo: ForDatabaseLevels, cache: ForCache, storage: StorageService) =>
				new LevelsCore(repo, cache, storage),
			inject: [LEVELS_REPO_PROVIDER, CACHE_PORT, STORAGE_SERVICE],
		},
	],
	exports: [LEVELS_REPO_PROVIDER, LEVELS_CORE_PROVIDER],
})
export class LevelsModule {}
