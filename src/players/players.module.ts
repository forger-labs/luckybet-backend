import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LevelsModule } from '../levels/levels.module';
import { FOR_PANEL_API_CORE } from '../panelApi/constants';
import type { ForPanelApiCore } from '../panelApi/ports/forPanelApiCore.port';
import { PlayerRepoService } from './adapters/driven/PlayerRepo.service';
import { PlayersController } from './adapters/driver/players.controller';
import { PLAYER_CORE_PROVIDER } from './app/constants';
import { Player } from './app/entities/player.entity';
import { PlayersCore } from './app/playersCore';
import { ForDatabasePlayers } from './ports/driver/ForDatabasePlayers';

@Module({
	imports: [TypeOrmModule.forFeature([Player]), forwardRef(() => LevelsModule)],
	controllers: [PlayersController],
	providers: [
		PlayerRepoService,
		{
			provide: PLAYER_CORE_PROVIDER,
			useFactory: (repo: ForDatabasePlayers, panelApi: ForPanelApiCore) =>
				new PlayersCore(repo, panelApi),
			inject: [PlayerRepoService, FOR_PANEL_API_CORE],
		},
	],
	exports: [PlayerRepoService, PLAYER_CORE_PROVIDER],
})
export class PlayersModule {}
