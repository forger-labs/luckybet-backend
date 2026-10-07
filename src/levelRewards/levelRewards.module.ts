import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LEVELS_CORE_PROVIDER } from '../levels/app/constants';
import { LevelsModule } from '../levels/levels.module';
import type { ForManageLevels } from '../levels/ports/drivens/forManageLevels';
import { FOR_PANEL_API_CORE } from '../panelApi/constants';
import { PanelModule } from '../panelApi/panel.module';
import type { ForPanelApiCore } from '../panelApi/ports/forPanelApiCore.port';
import { PlayerRepoService } from '../players/adapters/driven/PlayerRepo.service';
import { PlayersModule } from '../players/players.module';
import type { ForDatabasePlayers } from '../players/ports/driver/ForDatabasePlayers';
import { FOR_DATABASE_ROOMS } from '../rooms/app/constants';
import type { ForDatabaseRooms } from '../rooms/ports/driver/ForDatabaseRooms';
import { RoomsModule } from '../rooms/rooms.module';
import { LevelRewardRepoService } from './adapters/driven/LevelRewardRepo.service';
import { LevelRewardsController } from './adapters/driver/level-rewards.controller';
import { FOR_DATABASE_LEVEL_REWARDS, LEVEL_REWARDS_CORE_PROVIDER } from './app/constants';
import { LevelReward } from './app/entities/level-reward.entity';
import { LevelRewardsCore } from './app/levelRewardsCore';
import type { ForDatabaseLevelRewards } from './ports/driver/ForDatabaseLevelRewards';

@Module({
	imports: [
		TypeOrmModule.forFeature([LevelReward]),
		forwardRef(() => LevelsModule),
		forwardRef(() => PlayersModule),
		forwardRef(() => PanelModule),
		forwardRef(() => RoomsModule),
	],
	controllers: [LevelRewardsController],
	providers: [
		LevelRewardRepoService,
		{
			provide: FOR_DATABASE_LEVEL_REWARDS,
			useClass: LevelRewardRepoService,
		},
		{
			provide: LEVEL_REWARDS_CORE_PROVIDER,
			useFactory: (
				rewardRepo: ForDatabaseLevelRewards,
				levelsCore: ForManageLevels,
				panelApi: ForPanelApiCore,
				playerRepo: ForDatabasePlayers,
				roomRepo: ForDatabaseRooms,
			) => new LevelRewardsCore(rewardRepo, levelsCore, panelApi, playerRepo, roomRepo),
			inject: [
				FOR_DATABASE_LEVEL_REWARDS,
				LEVELS_CORE_PROVIDER,
				FOR_PANEL_API_CORE,
				PlayerRepoService,
				FOR_DATABASE_ROOMS,
			],
		},
	],
	exports: [
		LevelRewardRepoService,
		FOR_DATABASE_LEVEL_REWARDS,
		LEVEL_REWARDS_CORE_PROVIDER,
	],
})
export class LevelRewardsModule {}
