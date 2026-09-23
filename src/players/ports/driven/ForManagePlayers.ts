import type { PlayerGameHistoryResult } from '@/src/panelApi/types/adminPanel.types';
import type { PlayerAuthContext } from '@/src/panelApi/types/panelApiCore.types';
import type { PlayerLastPlayedGameResult } from '@/src/panelApi/types/userPanel.types';
import { CreatePlayerDto } from '../../app/dto/create-player.dto';
import { PlayerResponse } from '../../app/dto/player.schema';
import type { PlayerPlayedGamesFilter } from '../../app/dto/player-games.dto';
import { UpdatePlayerDto } from '../../app/dto/update-player.dto';

export interface ForManagePlayers {
	createPlayer(playerData: CreatePlayerDto): Promise<PlayerResponse>;
	findById(id: number): Promise<PlayerResponse>;
	getPlayers(params: { take?: number; skip?: number }): Promise<{
		players: PlayerResponse[];
		total: number;
		limit: number;
		skip: number;
	}>;
	updatePlayerById(id: number, playerData: UpdatePlayerDto): Promise<PlayerResponse>;
	getLastPlayedGame(token: string): Promise<PlayerLastPlayedGameResult | null>;
	getPlayedGames(
		player: PlayerAuthContext,
		filter?: PlayerPlayedGamesFilter & { token?: string },
	): Promise<PlayerGameHistoryResult>;
}
