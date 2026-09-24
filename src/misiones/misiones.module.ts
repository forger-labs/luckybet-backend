import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FOR_PANEL_API_CORE } from '../panelApi/constants';
import { PanelModule } from '../panelApi/panel.module';
import type { ForPanelApiCore } from '../panelApi/ports/forPanelApiCore.port';
import { PlayerRepoService } from '../players/adapters/driven/PlayerRepo.service';
import { PlayersModule } from '../players/players.module';
import type { ForDatabasePlayers } from '../players/ports/driver/ForDatabasePlayers';
import { REWARDS_CORE_PROVIDER } from '../rewards/app/constants';
import type { ForManageRewards } from '../rewards/ports/driven/ForManageRewards';
import { RewardsModule } from '../rewards/rewards.module';
import { STORAGE_SERVICE } from '../shared/storage/storage.constants';
import type { StorageService } from '../shared/storage/storage.port';
import { UserRepoService } from '../users/adapters/driven/UserRepo.service';
import { ForDatabaseUsers } from '../users/ports/driver/ForDatabaseUsers';
import { UsersModule } from '../users/users.module';
import { MissionRepoService } from './adapters/driven/MissionRepo.service';
import { MissionStepRepoService } from './adapters/driven/MissionStepRepo.service';
import { UserMissionRepoService } from './adapters/driven/UserMissionRepo.service';
import { UserMissionStepRepoService } from './adapters/driven/UserMissionStepRepo.service';
import { MissionsController } from './adapters/driver/misiones.controller';
import { PlayerMisionesController } from './adapters/driver/player-misiones.controller';
import { MISIONES_CORE_PROVIDER } from './app/constants';
import { Mission } from './app/entities/mission.entity';
import { MissionStep } from './app/entities/mission-step.entity';
import { UserMission } from './app/entities/user-mission.entity';
import { UserMissionStep } from './app/entities/user-mission-step.entity';
import { MisionesCore } from './app/misionesCore';
import type { ForDatabaseMissions } from './ports/driver/ForDatabaseMissions';
import type { ForDatabaseUserMissionSteps } from './ports/driver/ForDatabaseUserMissionSteps';
import type { ForDatabaseUserMissions } from './ports/driver/ForDatabaseUserMissions';

@Module({
	imports: [
		UsersModule,
		PlayersModule,
		PanelModule,
		forwardRef(() => RewardsModule),
		TypeOrmModule.forFeature([Mission, MissionStep, UserMission, UserMissionStep]),
	],
	controllers: [MissionsController, PlayerMisionesController],
	providers: [
		MissionRepoService,
		MissionStepRepoService,
		UserMissionRepoService,
		UserMissionStepRepoService,
		{
			provide: MISIONES_CORE_PROVIDER,
			useFactory: (
				missionRepo: ForDatabaseMissions,
				userMissionRepo: ForDatabaseUserMissions,
				stepRepo: ForDatabaseUserMissionSteps,
				userRepo: ForDatabaseUsers,
				storage: StorageService,
				panelApi: ForPanelApiCore,
				playerRepo: ForDatabasePlayers,
				rewardsCore: ForManageRewards,
			) =>
				new MisionesCore(
					missionRepo,
					userMissionRepo,
					stepRepo,
					userRepo,
					storage,
					panelApi,
					playerRepo,
					rewardsCore,
				),
			inject: [
				MissionRepoService,
				UserMissionRepoService,
				UserMissionStepRepoService,
				UserRepoService,
				STORAGE_SERVICE,
				FOR_PANEL_API_CORE,
				PlayerRepoService,
				REWARDS_CORE_PROVIDER,
			],
		},
	],
	exports: [MISIONES_CORE_PROVIDER],
})
export class MisionesModule {}
