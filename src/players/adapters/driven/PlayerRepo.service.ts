import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { LEVELS_CORE_PROVIDER } from '@/src/levels/app/constants';
import type { ForManageLevels } from '@/src/levels/ports/drivens/forManageLevels';
import { STORAGE_SERVICE } from '@/src/shared/storage/storage.constants';
import type { StorageService } from '@/src/shared/storage/storage.port';
import { FOR_DATABASE_LEVEL_REWARDS } from '../../../levelRewards/app/constants';
import type { ForDatabaseLevelRewards } from '../../../levelRewards/ports/driver/ForDatabaseLevelRewards';
import { FOR_PANEL_API_CORE } from '../../../panelApi/constants';
import type { ForPanelApiCore } from '../../../panelApi/ports/forPanelApiCore.port';
import { FOR_DATABASE_ROOMS } from '../../../rooms/app/constants';
import type { ForDatabaseRooms } from '../../../rooms/ports/driver/ForDatabaseRooms';
import { CreatePlayerDto } from '../../app/dto/create-player.dto';
import type {
	PlayerCreateResponse,
	PlayerUniqueFields,
	PlayerWithoutAudit,
} from '../../app/dto/player.schema';
import { UpdatePlayerDto } from '../../app/dto/update-player.dto';
import { Player } from '../../app/entities/player.entity';
import { ForDatabasePlayers } from '../../ports/driver/ForDatabasePlayers';

@Injectable()
export class PlayerRepoService implements ForDatabasePlayers {
	constructor(
		@InjectRepository(Player)
		private readonly playerModel: Repository<Player>,
		@Inject(LEVELS_CORE_PROVIDER)
		private readonly levelsCore: ForManageLevels,
		@Inject(STORAGE_SERVICE)
		@Optional()
		private readonly storage?: StorageService,
		@Inject(FOR_DATABASE_LEVEL_REWARDS)
		@Optional()
		private readonly levelRewardRepo?: ForDatabaseLevelRewards,
	) {}

	private toPublicUrl(key?: string | null): string {
		if (!key) return '';
		if (key.startsWith('http://') || key.startsWith('https://')) {
			return key;
		}
		return this.storage ? this.storage.buildPublicUrl(key) : key;
	}

	async createPlayer({
		username,
		phone,
		isActive,
		levelId,
		roomId,
	}: CreatePlayerDto): Promise<PlayerCreateResponse> {
		let assignedLevelId = levelId;
		let lowestLevelData: {
			id: number;
			name: string;
			image: string;
			minExperience: number;
		} | null = null;

		// Si no se proporciona un levelId, obtener el nivel más bajo desde LevelsCore (Cacheado en Redis)
		if (!assignedLevelId) {
			const lowestLevel = await this.levelsCore.getLowestLevel();
			if (lowestLevel) {
				assignedLevelId = lowestLevel.id;
				lowestLevelData = {
					id: lowestLevel.id,
					name: lowestLevel.name,
					image: lowestLevel.image,
					minExperience: lowestLevel.minExperience,
				};
			}
		}

		const player = this.playerModel.create({
			username,
			isActive,
			phone: phone ?? undefined,
			levelId: assignedLevelId ?? undefined,
			roomId: roomId ?? undefined,
		});
		const saved = await this.playerModel.save(player);

		return {
			id: saved.id,
			username: saved.username,
			phone: saved.phone ?? null,
			isActive: saved.isActive,
			experience: 0,
			levelId: saved.levelId ?? null,
			level: lowestLevelData,
			roomId: saved.roomId ?? null,
			room: null,
		};
	}

	async updatePlayerById(
		id: number,
		playerData: UpdatePlayerDto,
	): Promise<PlayerWithoutAudit | null> {
		const player = await this.playerModel.findOne({
			where: { id },
			select: {
				isActive: true,
				experience: true,
				id: true,
				levelId: true,
				level: {
					image: true,
					name: true,
					minExperience: true,
					id: true,
				},
			},
			relations: {
				level: true,
				room: true,
			},
		});
		if (!player) {
			return null;
		}
		Object.assign(player, playerData);
		const result = (await this.playerModel.save(player)) as Player;
		return {
			id: result.id,
			username: result.username,
			phone: result.phone ?? null,
			isActive: result.isActive,
			experience: result.experience,
			level: result.level
				? {
						id: result.level.id,
						image: this.toPublicUrl(result.level.image),
						minExperience: result.level.minExperience,
						name: result.level.name,
					}
				: null,
			levelId: result.levelId ?? null,
			roomId: result.roomId ?? null,
			room: result.room
				? {
						id: result.room.id,
						name: result.room.name,
						bonus: String(result.room.bonus),
						isActive: result.room.isActive,
					}
				: null,
		};
	}

	async getPlayers({
		take = 100,
		skip = 0,
	}: {
		take?: number;
		skip?: number;
	}): Promise<[PlayerWithoutAudit[], number]> {
		const [players, count] = await this.playerModel.findAndCount({
			skip,
			take,
			order: { created_at: 'DESC' },
			select: {
				isActive: true,
				experience: true,
				id: true,
				username: true,
				phone: true,
				levelId: true,
				roomId: true,
				level: {
					image: true,
					name: true,
					minExperience: true,
					id: true,
				},
			},
			relations: {
				level: true,
				room: true,
			},
		});

		return [
			players.map(p => ({
				id: p.id,
				username: p.username,
				phone: p.phone ?? null,
				isActive: p.isActive,
				experience: p.experience,
				level: p.level
					? {
							id: p.level.id,
							image: this.toPublicUrl(p.level.image),
							minExperience: p.level.minExperience,
							name: p.level.name,
						}
					: null,
				levelId: p.levelId ?? null,
				roomId: p.roomId ?? null,
				room: p.room
					? {
							id: p.room.id,
							name: p.room.name,
							bonus: String(p.room.bonus),
							isActive: p.room.isActive,
						}
					: null,
			})),
			count,
		];
	}

	async addExperienceAndRecalculateLevel(
		playerId: number,
		expPoints: number,
	): Promise<{
		player: PlayerWithoutAudit;
		upgradedLevel: boolean;
		newLevelId?: number;
	}> {
		const player = await this.playerModel.findOne({
			where: { id: playerId },
			relations: { level: true, room: true },
		});
		if (!player) throw new Error(`Player con ID ${playerId} no encontrado`);

		const newExp = (player.experience || 0) + Math.max(0, expPoints);
		player.experience = newExp;

		// Obtener todos los niveles ordenados por minExperience DESC para hallar el nivel más alto aplicable
		const { levels: allLevels } = await this.levelsCore.getLevels({ take: 100, skip: 0 });
		const sortedLevels = [...allLevels].sort((a, b) => b.minExperience - a.minExperience);
		const targetLevel =
			sortedLevels.find(l => newExp >= l.minExperience) || sortedLevels.at(-1);

		let upgradedLevel = false;
		let newLevelId: number | undefined;

		if (targetLevel && targetLevel.id !== player.levelId) {
			upgradedLevel = true;
			player.levelId = targetLevel.id;
			newLevelId = targetLevel.id;

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

		await this.playerModel.save(player);
		const updatedPlayer = await this.findByUnique({ id: playerId });

		if (!updatedPlayer) throw new Error(`Error al recargar player ${playerId}`);
		return {
			player: updatedPlayer,
			upgradedLevel,
			newLevelId,
		};
	}

	async findByUnique(options: PlayerUniqueFields): Promise<PlayerWithoutAudit | null> {
		const result = await this.playerModel.findOne({
			where: options,
			select: {
				isActive: true,
				experience: true,
				id: true,
				levelId: true,
				roomId: true,
				level: {
					image: true,
					name: true,
					minExperience: true,
					id: true,
				},
			},
			relations: {
				level: true,
				room: true,
			},
		});

		return result
			? {
					id: result.id,
					username: result.username,
					phone: result.phone ?? null,
					isActive: result.isActive,
					experience: result.experience,
					level: result.level
						? {
								id: result.level.id,
								image: this.toPublicUrl(result.level.image),
								minExperience: result.level.minExperience,
								name: result.level.name,
							}
						: null,
					levelId: result.levelId ?? null,
					roomId: result.roomId ?? null,
					room: result.room
						? {
								id: result.room.id,
								name: result.room.name,
								bonus: String(result.room.bonus),
								isActive: result.room.isActive,
							}
						: null,
				}
			: null;
	}
}
