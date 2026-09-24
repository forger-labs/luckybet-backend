import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { MisionesModule } from '../misiones/misiones.module';
import { FOR_PANEL_API_CORE } from '../panelApi/constants';
import { PanelModule } from '../panelApi/panel.module';
import type { ForPanelApiCore } from '../panelApi/ports/forPanelApiCore.port';
import { MissionRewardRepoService } from './adapters/driven/MissionRewardRepo.service';
import { RewardsController } from './adapters/driver/rewards.controller';
import {
	FOR_DATABASE_MISSION_REWARDS,
	REWARDS_CORE_PROVIDER,
} from './app/constants';
import { MissionReward } from './app/entities/mission-reward.entity';
import { RewardsCore } from './app/rewardsCore';
import type { ForDatabaseMissionRewards } from './ports/driver/ForDatabaseMissionRewards';

@Module({
	imports: [
		TypeOrmModule.forFeature([MissionReward]),
		PanelModule,
		AuthModule,
		forwardRef(() => MisionesModule),
	],
	controllers: [RewardsController],
	providers: [
		{
			provide: FOR_DATABASE_MISSION_REWARDS,
			useClass: MissionRewardRepoService,
		},
		{
			provide: REWARDS_CORE_PROVIDER,
			useFactory: (
				rewardRepo: ForDatabaseMissionRewards,
				panelApi: ForPanelApiCore,
			) => new RewardsCore(rewardRepo, panelApi),
			inject: [FOR_DATABASE_MISSION_REWARDS, FOR_PANEL_API_CORE],
		},
	],
	exports: [REWARDS_CORE_PROVIDER, FOR_DATABASE_MISSION_REWARDS],
})
export class RewardsModule {}
