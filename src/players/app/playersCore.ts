import {
	BadRequestException,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';

import type { ForPanelApiCore } from '@/src/panelApi/ports/forPanelApiCore.port';
import type { PlayerGameHistoryResult } from '@/src/panelApi/types/adminPanel.types';
import type { PlayerAuthContext } from '@/src/panelApi/types/panelApiCore.types';
import type { PlayerLastPlayedGameResult } from '@/src/panelApi/types/userPanel.types';
import type { ForManagePlayers } from '../ports/driven/ForManagePlayers';
import type { ForDatabasePlayers } from '../ports/driver/ForDatabasePlayers';
import { CreatePlayerDto } from './dto/create-player.dto';
import { PlayerResponse } from './dto/player.schema';
import type { PlayerPlayedGamesFilter } from './dto/player-games.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';

export class PlayersCore implements ForManagePlayers {
	constructor(
		private readonly playersRepo: ForDatabasePlayers,
		private readonly panelApiCore?: ForPanelApiCore,
	) {}

	async createPlayer(playerData: CreatePlayerDto): Promise<PlayerResponse> {
		const existingPlayer = await this.playersRepo.findByUnique({
			username: playerData.username,
		});

		if (existingPlayer) {
			throw new BadRequestException('El jugador ya existe');
		}

		return await this.playersRepo.createPlayer(playerData);
	}

	async findById(id: number): Promise<PlayerResponse> {
		const player = await this.playersRepo.findByUnique({ id });

		if (!player) {
			throw new NotFoundException('Recurso no encontrado');
		}

		return player;
	}

	async getPlayers({ take = 100, skip = 0 }: { take?: number; skip?: number }): Promise<{
		players: PlayerResponse[];
		total: number;
		limit: number;
		skip: number;
	}> {
		const [players, total] = await this.playersRepo.getPlayers({
			take,
			skip,
		});
		return {
			players,
			total,
			limit: take,
			skip,
		};
	}

	async updatePlayerById(
		id: number,
		playerData: UpdatePlayerDto,
	): Promise<PlayerResponse> {
		const player = await this.playersRepo.updatePlayerById(id, playerData);
		if (!player) {
			throw new NotFoundException('Recurso no encontrado');
		}
		return player;
	}

	async getLastPlayedGame(token: string): Promise<PlayerLastPlayedGameResult | null> {
		if (!this.panelApiCore) {
			throw new BadRequestException('PanelApiCore no disponible');
		}
		if (!token || typeof token !== 'string' || !token.trim()) {
			throw new UnauthorizedException('Token de autenticación de jugador requerido');
		}
		return await this.panelApiCore.getLastPlayedGame(token.trim());
	}

	async getPlayedGames(
		player: PlayerAuthContext,
		filter?: PlayerPlayedGamesFilter & { token?: string },
	): Promise<PlayerGameHistoryResult> {
		if (!this.panelApiCore) {
			throw new BadRequestException('PanelApiCore no disponible');
		}
		const identifier = player.luckyBetId ?? player.username;
		return await this.panelApiCore.getLastPlayedGames(identifier, filter);
	}
}
