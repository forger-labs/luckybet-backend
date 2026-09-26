import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, ILike, MoreThanOrEqual, Repository } from 'typeorm';
import { LessThanOrEqual } from 'typeorm/browser';

import type { ChestBasic, FilterChestDTO } from '../../app/dto/chest.schema';
import { MissionChest } from '../../app/entities/mission-chest.entity';
import type {
	CreateChestInput,
	ForDatabaseChests,
	UpdateChestInput,
} from '../../ports/driver/ForDatabaseChests';

@Injectable()
export class MissionChestRepoService implements ForDatabaseChests {
	constructor(
		@InjectRepository(MissionChest)
		private readonly chestModel: Repository<MissionChest>,
	) {}

	async createChest(data: CreateChestInput): Promise<ChestBasic> {
		const entity = this.chestModel.create(data);
		const saved = await this.chestModel.save(entity);
		return this.toBasic(saved);
	}

	async findById(id: number): Promise<ChestBasic | null> {
		const chest = await this.chestModel.findOne({ where: { id } });
		return chest ? this.toBasic(chest) : null;
	}

	async updateChest(id: number, data: UpdateChestInput): Promise<ChestBasic | null> {
		await this.chestModel.update(id, data);
		const updated = await this.chestModel.findOne({ where: { id } });
		return updated ? this.toBasic(updated) : null;
	}

	async getChests(params: FilterChestDTO): Promise<[ChestBasic[], number]> {
		const where: FindOptionsWhere<MissionChest> = {};
		if (params.periodType !== undefined) where.periodType = params.periodType;
		if (params.isActive !== undefined) where.isActive = params.isActive;

		if (params.maxCoins !== undefined && params.minCoins !== undefined) {
			where.coinsAmount = Between(params.minCoins, params.maxCoins);
		} else if (params.minCoins !== undefined) {
			where.coinsAmount = MoreThanOrEqual(params.minCoins);
		} else if (params.maxCoins !== undefined) {
			where.coinsAmount = LessThanOrEqual(params.maxCoins);
		}

		if (
			params.maxRequiredMissions !== undefined &&
			params.minRequiredMissions !== undefined
		) {
			where.requiredMissions = Between(
				params.minRequiredMissions,
				params.maxRequiredMissions,
			);
		} else if (params.minRequiredMissions !== undefined) {
			where.requiredMissions = MoreThanOrEqual(params.minRequiredMissions);
		} else if (params.maxRequiredMissions !== undefined) {
			where.requiredMissions = LessThanOrEqual(params.maxRequiredMissions);
		}

		if (params.title !== undefined && params.title) {
			where.title = ILike(`%${params.title}%`);
		}

		if (params.roomId !== undefined && params.roomId > 0) {
			where.roomId = params.roomId;
		}

		const [list, count] = await this.chestModel.findAndCount({
			where,
			take: params.take ?? 50,
			skip: params.skip ?? 0,
			order: { created_at: 'DESC' },
			select: {
				coinsAmount: true,
				created_at: true,
				description: true,
				experiencePoints: true,
				id: true,
				imageUrl: true,
				isActive: true,
				periodType: true,
				requiredMissions: true,
				room: { bonus: true, id: true, name: true },
				roomId: true,
				title: true,
			},
			relations: {
				room: true,
			},
		});

		return [list.map(c => this.toBasic(c)), count];
	}

	private toBasic(chest: MissionChest): ChestBasic {
		return {
			id: chest.id,
			title: chest.title,
			description: chest.description,
			periodType: chest.periodType,
			requiredMissions: chest.requiredMissions,
			coinsAmount: chest.coinsAmount,
			roomId: chest.roomId,
			experiencePoints: chest.experiencePoints,
			imageUrl: chest.imageUrl,
			isActive: chest.isActive,
			createdAt: chest.created_at,
			updatedAt: chest.updated_at,
			...(chest.room
				? {
						room: {
							bonus: chest.room.bonus,
							id: chest.room.id,
							name: chest.room.name,
						},
					}
				: {}),
		};
	}
}
