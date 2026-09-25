import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { CHESTS_CORE_PROVIDER } from '../chests/app/constants';
import { ChestsModule } from '../chests/chests.module';
import type { ForManageChests } from '../chests/ports/driven/ForManageChests';
import { UserMissionRepoService } from '../misiones/adapters/driven/UserMissionRepo.service';
import { MisionesModule } from '../misiones/misiones.module';
import type { ForDatabaseUserMissions } from '../misiones/ports/driver/ForDatabaseUserMissions';
import { FOR_PANEL_API_CORE } from '../panelApi/constants';
import { PanelModule } from '../panelApi/panel.module';
import type { ForPanelApiCore } from '../panelApi/ports/forPanelApiCore.port';
import { PLAYER_CORE_PROVIDER } from '../players/app/constants';
import { PlayersModule } from '../players/players.module';
import type { ForManagePlayers } from '../players/ports/driven/ForManagePlayers';
import { RewardsModule } from '../rewards/rewards.module';
import { FOR_DATABASE_ROOMS } from '../rooms/app/constants';
import type { ForDatabaseRooms } from '../rooms/ports/driver/ForDatabaseRooms';
import { RoomsModule } from '../rooms/rooms.module';
import { UserMissionChestRepoService } from './adapters/driven/UserMissionChestRepo.service';
import { PlayerChestsController } from './adapters/driver/player-chests.controller';
import { FOR_DATABASE_PLAYER_CHESTS, PLAYER_CHESTS_CORE_PROVIDER } from './app/constants';
import { UserMissionChest } from './app/entities/user-mission-chest.entity';
import { PlayerChestsCore } from './app/playerChestsCore';
import type { ForDatabasePlayerChests } from './ports/driver/ForDatabasePlayerChests';

@Module({
	imports: [
		TypeOrmModule.forFeature([UserMissionChest]),
		ChestsModule,
		MisionesModule,
		PanelModule,
		PlayersModule,
		RoomsModule,
		RewardsModule,
		AuthModule,
	],
	controllers: [PlayerChestsController],
	providers: [
		{
			provide: FOR_DATABASE_PLAYER_CHESTS,
			useClass: UserMissionChestRepoService,
		},
		{
			provide: PLAYER_CHESTS_CORE_PROVIDER,
			useFactory: (
				claimRepo: ForDatabasePlayerChests,
				chestsCore: ForManageChests,
				userMissionRepo: ForDatabaseUserMissions,
				panelApi: ForPanelApiCore,
				playerCore: ForManagePlayers,
				roomRepo: ForDatabaseRooms,
			) =>
				new PlayerChestsCore(
					claimRepo,
					chestsCore,
					userMissionRepo,
					panelApi,
					playerCore,
					roomRepo,
				),
			inject: [
				FOR_DATABASE_PLAYER_CHESTS,
				CHESTS_CORE_PROVIDER,
				UserMissionRepoService,
				FOR_PANEL_API_CORE,
				PLAYER_CORE_PROVIDER,
				FOR_DATABASE_ROOMS,
			],
		},
	],
	exports: [PLAYER_CHESTS_CORE_PROVIDER, FOR_DATABASE_PLAYER_CHESTS],
})
export class PlayerChestsModule {}
