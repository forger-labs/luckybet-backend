import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { LEVELS_CORE_PROVIDER } from '@/src/levels/app/constants';
import type { ForManageLevels } from '@/src/levels/ports/drivens/forManageLevels';
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
	) {}

	async createPlayer({
		username,
		phone,
		isActive,
		levelId,
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
						image: result.level.image,
						minExperience: result.level.minExperience,
						name: result.level.name,
					}
				: null,
			levelId: result.levelId ?? null,
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
			},
		});

		return [
			players.map(
				({ id, username, isActive, phone, level, levelId, experience }: Player) => ({
					id,
					username,
					phone: phone ?? null,
					isActive,
					experience,
					level: level
						? {
								id: level.id,
								image: level.image,
								minExperience: level.minExperience,
								name: level.name,
							}
						: null,
					levelId: levelId ?? null,
				}),
			),
			count,
		];
	}

	async findByUnique(options: PlayerUniqueFields): Promise<PlayerWithoutAudit | null> {
		const result = await this.playerModel.findOne({
			where: options,
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
								image: result.level.image,
								minExperience: result.level.minExperience,
								name: result.level.name,
							}
						: null,
					levelId: result.levelId ?? null,
				}
			: null;
	}
}
