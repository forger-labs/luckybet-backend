import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { MissionChest } from '../chests/app/entities/mission-chest.entity';
import { LevelReward } from '../levelRewards/app/entities/level-reward.entity';
import { LevelsEntity } from '../levels/app/entities/levels.entity';
import { UserMission } from '../misiones/app/entities/user-mission.entity';
import { UserMissionStep } from '../misiones/app/entities/user-mission-step.entity';
import { UserMissionChest } from '../playerChests/app/entities/user-mission-chest.entity';
import { Player } from '../players/app/entities/player.entity';
import { MissionReward } from '../rewards/app/entities/mission-reward.entity';
import { StatisticsRepoService } from './adapters/driven/statisticsRepo.service';
import { StatisticsController } from './adapters/driver/statistics.controller';
import { StatisticsPublicController } from './adapters/driver/statistics-public.controller';
import { STATISTICS_CORE_PROVIDER, STATISTICS_REPO_PROVIDER } from './app/constants';
import { StatisticsCore } from './app/statisticsCore';
import type { ForDatabaseStatistics } from './ports/driver/forDatabaseStatistics';

@Module({
	imports: [
		AuthModule,
		TypeOrmModule.forFeature([
			MissionReward,
			LevelReward,
			UserMissionChest,
			UserMission,
			UserMissionStep,
			MissionChest,
			Player,
			LevelsEntity,
		]),
	],
	controllers: [StatisticsController, StatisticsPublicController],
	providers: [
		StatisticsRepoService,
		{
			provide: STATISTICS_REPO_PROVIDER,
			useClass: StatisticsRepoService,
		},
		{
			provide: STATISTICS_CORE_PROVIDER,
			useFactory: (repo: ForDatabaseStatistics) => new StatisticsCore(repo),
			inject: [STATISTICS_REPO_PROVIDER],
		},
	],
	exports: [STATISTICS_CORE_PROVIDER, STATISTICS_REPO_PROVIDER],
})
export class StatisticsModule {}
