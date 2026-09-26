import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	Between,
	type FindOptionsWhere,
	ILike,
	LessThanOrEqual,
	MoreThanOrEqual,
	Repository,
} from 'typeorm';

import { CreatePlayerDto } from '../../app/dto/create-player.dto';
import {
	type PlayerCreateResponse,
	type PlayerFilter,
	type PlayerUniqueFields,
	type PlayerWithoutAudit,
	SortOrder,
} from '../../app/dto/player.schema';
import { UpdatePlayerDto } from '../../app/dto/update-player.dto';
import { Player } from '../../app/entities/player.entity';
import type { ForDatabasePlayers } from '../../ports/driver/ForDatabasePlayers';

@Injectable()
export class PlayerRepoService implements ForDatabasePlayers {
	constructor(
		@InjectRepository(Player)
		private readonly playerModel: Repository<Player>,
	) {}

	async createPlayer(data: CreatePlayerDto): Promise<PlayerCreateResponse> {
		const player = this.playerModel.create({
			username: data.username,
			isActive: data.isActive,
			phone: data.phone ?? undefined,
			levelId: data.levelId ?? undefined,
			roomId: data.roomId ?? undefined,
			experience: 0,
		});
		const saved = await this.playerModel.save(player);

		return {
			id: saved.id,
			username: saved.username,
			phone: saved.phone ?? null,
			isActive: saved.isActive,
			experience: 0,
			levelId: saved.levelId ?? null,
			level: null,
			roomId: saved.roomId ?? null,
			room: null,
		};
	}

	async updatePlayerById(
		id: number,
		playerData: UpdatePlayerDto,
	): Promise<PlayerWithoutAudit | null> {
		const updateData: Record<string, unknown> = { ...playerData };
		if (updateData.phone === null) {
			updateData.phone = undefined;
		}
		const updateResult = await this.playerModel.update(id, updateData);
		if (updateResult.affected === 0) {
			const exists = await this.playerModel.findOne({ where: { id } });
			if (!exists) return null;
		}

		return await this.findByUnique({ id });
	}

	async getPlayers(filter?: PlayerFilter): Promise<[PlayerWithoutAudit[], number]> {
		const where: FindOptionsWhere<Player> = {};

		if (filter?.username) {
			where.username = ILike(`%${filter.username}%`);
		}
		if (filter?.phone) {
			where.phone = ILike(`%${filter.phone}%`);
		}
		if (filter?.levelId !== undefined && filter?.levelId !== null) {
			where.levelId = filter.levelId;
		}
		if (filter?.roomId !== undefined && filter?.roomId !== null) {
			where.roomId = filter.roomId;
		}
		if (filter?.isActive !== undefined && filter?.isActive !== null) {
			where.isActive = filter.isActive;
		}

		if (filter?.minExperience !== undefined && filter?.maxExperience !== undefined) {
			where.experience = Between(filter.minExperience, filter.maxExperience);
		} else if (filter?.minExperience !== undefined) {
			where.experience = MoreThanOrEqual(filter.minExperience);
		} else if (filter?.maxExperience !== undefined) {
			where.experience = LessThanOrEqual(filter.maxExperience);
		}

		const orderDirection = filter?.orderDirection ?? SortOrder.DESC;

		const [players, count] = await this.playerModel.findAndCount({
			skip: filter?.skip ?? 0,
			take: filter?.take ?? 50,
			order: { created_at: orderDirection },
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
				created_at: true,
				room: {
					bonus: true,
					id: true,
					name: true,
				},
			},
			relations: {
				level: true,
				room: true,
			},
		});

		return [players.map(p => this.toModel(p)), count];
	}

	async addExperience(
		playerId: number,
		expPoints: number,
	): Promise<{
		player: PlayerWithoutAudit;
		previousExperience: number;
		newExperience: number;
	}> {
		const player = await this.playerModel.findOne({
			where: { id: playerId },
			select: { id: true, experience: true },
		});
		if (!player) throw new NotFoundException(`Player con ID ${playerId} no encontrado`);

		const previousExperience = player.experience || 0;
		const newExperience = previousExperience + Math.max(0, expPoints);

		await this.playerModel.update(playerId, { experience: newExperience });
		const updated = await this.findByUnique({ id: playerId });
		// biome-ignore lint/style/noNonNullAssertion: verified updated
		return { player: updated!, previousExperience, newExperience };
	}

	async updateLevel(playerId: number, levelId: number): Promise<PlayerWithoutAudit> {
		await this.playerModel.update(playerId, { levelId });
		const updated = await this.findByUnique({ id: playerId });
		if (!updated) throw new NotFoundException(`Player con ID ${playerId} no encontrado`);
		return updated;
	}

	async findByUnique(options: PlayerUniqueFields): Promise<PlayerWithoutAudit | null> {
		const result = await this.playerModel.findOne({
			where: options,
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

		return result ? this.toModel(result) : null;
	}

	private toModel(p: Player): PlayerWithoutAudit {
		return {
			id: p.id,
			username: p.username,
			phone: p.phone ?? null,
			isActive: p.isActive,
			experience: p.experience,
			level: p.level
				? {
						id: p.level.id,
						image: p.level.image,
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
		};
	}
}
