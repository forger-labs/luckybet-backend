import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FOR_DATABASE_LEVEL_REWARDS } from '../levelRewards/app/constants';
import { LevelRewardsModule } from '../levelRewards/levelRewards.module';
import type { ForDatabaseLevelRewards } from '../levelRewards/ports/driver/ForDatabaseLevelRewards';
import { LEVELS_CORE_PROVIDER } from '../levels/app/constants';
import { LevelsModule } from '../levels/levels.module';
import type { ForManageLevels } from '../levels/ports/drivens/forManageLevels';
import { FOR_PANEL_API_CORE } from '../panelApi/constants';
import type { ForPanelApiCore } from '../panelApi/ports/forPanelApiCore.port';
import { RoomsModule } from '../rooms/rooms.module';
import { STORAGE_SERVICE } from '../shared/storage/storage.constants';
import type { StorageService } from '../shared/storage/storage.port';
import { PlayerRepoService } from './adapters/driven/PlayerRepo.service';
import { PlayersController } from './adapters/driver/players.controller';
import { PLAYER_CORE_PROVIDER } from './app/constants';
import { Player } from './app/entities/player.entity';
import { PlayersCore } from './app/playersCore';
import type { ForDatabasePlayers } from './ports/driver/ForDatabasePlayers';

@Module({
	imports: [
		TypeOrmModule.forFeature([Player]),
		forwardRef(() => LevelsModule),
		forwardRef(() => RoomsModule),
		forwardRef(() => LevelRewardsModule),
	],
	controllers: [PlayersController],
	providers: [
		PlayerRepoService,
		{
			provide: PLAYER_CORE_PROVIDER,
			useFactory: (
				repo: ForDatabasePlayers,
				storage: StorageService,
				levelsCore: ForManageLevels,
				levelRewardRepo: ForDatabaseLevelRewards,
				panelApi?: ForPanelApiCore,
			) => new PlayersCore(repo, storage, levelsCore, levelRewardRepo, panelApi),
			inject: [
				PlayerRepoService,
				STORAGE_SERVICE,
				LEVELS_CORE_PROVIDER,
				FOR_DATABASE_LEVEL_REWARDS,
				FOR_PANEL_API_CORE,
			],
		},
	],
	exports: [PlayerRepoService, PLAYER_CORE_PROVIDER],
})
export class PlayersModule {}
