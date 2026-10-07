import {
	BadRequestException,
	Inject,
	Injectable,
	NotFoundException,
	Optional,
	UnauthorizedException,
} from '@nestjs/common';

import { LEVELS_CORE_PROVIDER } from '@/src/levels/app/constants';
import type { ForManageLevels } from '@/src/levels/ports/drivens/forManageLevels';
import { FOR_PANEL_API_CORE } from '@/src/panelApi/constants';
import type { ForPanelApiCore } from '@/src/panelApi/ports/forPanelApiCore.port';
import type { PlayerGameHistoryResult } from '@/src/panelApi/types/adminPanel.types';
import type { PlayerAuthContext } from '@/src/panelApi/types/panelApiCore.types';
import type { PlayerLastPlayedGameResult } from '@/src/panelApi/types/userPanel.types';
import { STORAGE_SERVICE } from '@/src/shared/storage/storage.constants';
import type { StorageService } from '@/src/shared/storage/storage.port';
import { FOR_DATABASE_LEVEL_REWARDS } from '../../levelRewards/app/constants';
import type { ForDatabaseLevelRewards } from '../../levelRewards/ports/driver/ForDatabaseLevelRewards';
import type { ForManagePlayers } from '../ports/driven/ForManagePlayers';
import type { ForDatabasePlayers } from '../ports/driver/ForDatabasePlayers';
import { CreatePlayerDto } from './dto/create-player.dto';
import type { PlayerFilter, PlayerResponse } from './dto/player.schema';
import type { PlayerPlayedGamesFilter } from './dto/player-games.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';

@Injectable()
export class PlayersCore implements ForManagePlayers {
	constructor(
		private readonly playersRepo: ForDatabasePlayers,
		@Inject(STORAGE_SERVICE)
		@Optional()
		private readonly storage?: StorageService,
		@Inject(LEVELS_CORE_PROVIDER)
		@Optional()
		private readonly levelsCore?: ForManageLevels,
		@Inject(FOR_DATABASE_LEVEL_REWARDS)
		@Optional()
		private readonly levelRewardRepo?: ForDatabaseLevelRewards,
		@Inject(FOR_PANEL_API_CORE)
		@Optional()
		private readonly panelApiCore?: ForPanelApiCore,
	) {}

	private toPublicUrl(key?: string | null): string {
		if (!key) return '';
		if (key.startsWith('http://') || key.startsWith('https://')) {
			return key;
		}
		return this.storage ? this.storage.buildPublicUrl(key) : key;
	}

	private enrichPlayerUrls(player: PlayerResponse): PlayerResponse {
		if (player.level?.image) {
			return {
				...player,
				level: {
					...player.level,
					image: this.toPublicUrl(player.level.image),
				},
			};
		}
		return player;
	}

	async createPlayer(playerData: CreatePlayerDto): Promise<PlayerResponse> {
		const existingPlayer = await this.playersRepo.findByUnique({
			username: playerData.username,
		});

		if (existingPlayer) {
			throw new BadRequestException('El jugador ya existe');
		}

		let assignedLevelId = playerData.levelId;
		let lowestLevelData: {
			id: number;
			name: string;
			image: string;
			minExperience: number;
		} | null = null;

		// Si no se proporciona un levelId, obtener el nivel más bajo desde LevelsCore
		if (!assignedLevelId && this.levelsCore) {
			const lowestLevel = await this.levelsCore.getLowestLevel();
			if (lowestLevel) {
				assignedLevelId = lowestLevel.id;
				lowestLevelData = {
					id: lowestLevel.id,
					name: lowestLevel.name,
					image: this.toPublicUrl(lowestLevel.image),
					minExperience: lowestLevel.minExperience,
				};
			}
		}

		const created = await this.playersRepo.createPlayer({
			...playerData,
			levelId: assignedLevelId,
		});

		return {
			...created,
			level: lowestLevelData ?? created.level ?? null,
		};
	}

	async findById(id: number): Promise<PlayerResponse> {
		const player = await this.playersRepo.findByUnique({ id });

		if (!player) {
			throw new NotFoundException('Recurso no encontrado');
		}

		return this.enrichPlayerUrls(player);
	}

	async getPlayers(filter?: PlayerFilter): Promise<{
		players: PlayerResponse[];
		total: number;
		limit: number;
		skip: number;
	}> {
		const [players, total] = await this.playersRepo.getPlayers(filter);
		return {
			players: players.map(p => this.enrichPlayerUrls(p)),
			total,
			limit: filter?.take ?? 50,
			skip: filter?.skip ?? 0,
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
		return this.enrichPlayerUrls(player);
	}

	async addExperienceAndRecalculateLevel(
		playerId: number,
		expPoints: number,
	): Promise<{
		player: PlayerResponse;
		upgradedLevel: boolean;
		newLevelId?: number;
	}> {
		const { player: current, newExperience } = await this.playersRepo.addExperience(
			playerId,
			expPoints,
		);

		let upgradedLevel = false;
		let newLevelId: number | undefined;
		let updatedPlayer = current;

		if (this.levelsCore) {
			const { levels: allLevels } = await this.levelsCore.getLevels({
				take: 100,
				skip: 0,
			});
			const sortedLevels = [...allLevels].sort(
				(a, b) => b.minExperience - a.minExperience,
			);
			const targetLevel =
				sortedLevels.find(l => newExperience >= l.minExperience) || sortedLevels.at(-1);

			if (targetLevel && targetLevel.id !== current.levelId) {
				upgradedLevel = true;
				newLevelId = targetLevel.id;
				updatedPlayer = await this.playersRepo.updateLevel(playerId, targetLevel.id);

				// Generar automáticamente el registro de recompensa por ascenso de nivel en estado PENDING
				if (this.levelRewardRepo) {
					const existingReward = await this.levelRewardRepo.findByPlayerAndLevel(
						playerId,
						targetLevel.id,
					);
					if (!existingReward) {
						await this.levelRewardRepo
							.createReward({
								playerId,
								levelId: targetLevel.id,
								coinsAmount: targetLevel.coins ?? 0,
								roomId: targetLevel.roomId,
							})
							.catch(() => undefined);
					}
				}
			}
		}

		return {
			player: this.enrichPlayerUrls(updatedPlayer),
			upgradedLevel,
			newLevelId,
		};
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
