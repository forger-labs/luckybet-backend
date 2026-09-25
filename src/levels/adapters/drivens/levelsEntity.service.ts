import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	Between,
	type FindOptionsWhere,
	LessThanOrEqual,
	Like,
	MoreThanOrEqual,
	Repository,
} from 'typeorm';

import {
	CreateLevelType,
	LevelsFilter,
	LevelType,
	UpdateLevelType,
} from '../../app/dto/level.schema';
import { LevelsEntity } from '../../app/entities/levels.entity';
import type { ForDatabaseLevels } from '../../ports/drivers/forDatabaseLevels';

@Injectable()
export class LevelsEntityService implements ForDatabaseLevels {
	constructor(
		@InjectRepository(LevelsEntity)
		private readonly levelsRepo: Repository<LevelsEntity>,
	) {}

	async findById(id: number): Promise<LevelType | null> {
		const level = await this.levelsRepo.findOne({
			where: { id },
		});
		return level ? this.toModel(level) : null;
	}

	async findAll(
		limit: number,
		skip: number,
		filters?: LevelsFilter,
	): Promise<[LevelType[], number]> {
		const where: FindOptionsWhere<LevelsEntity> = {};

		if (filters?.roomId) {
			where.roomId = filters.roomId;
		}
		if (filters?.name) {
			where.name = Like(`%${filters.name}%`);
		}
		if (
			filters?.minCoins !== undefined &&
			filters?.minCoins !== null &&
			filters?.maxCoins !== undefined &&
			filters?.maxCoins !== null
		) {
			where.coins = Between(filters.minCoins, filters.maxCoins);
		} else if (filters?.minCoins !== undefined && filters?.minCoins !== null) {
			where.coins = MoreThanOrEqual(filters.minCoins);
		} else if (filters?.maxCoins !== undefined && filters?.maxCoins !== null) {
			where.coins = LessThanOrEqual(filters.maxCoins);
		}

		if (
			filters?.minExperience !== undefined &&
			filters?.minExperience !== null &&
			filters?.maxExperience !== undefined &&
			filters?.maxExperience !== null
		) {
			where.minExperience = Between(filters.minExperience, filters.maxExperience);
		} else if (filters?.minExperience !== undefined && filters?.minExperience !== null) {
			where.minExperience = MoreThanOrEqual(filters.minExperience);
		} else if (filters?.maxExperience !== undefined && filters?.maxExperience !== null) {
			where.minExperience = LessThanOrEqual(filters.maxExperience);
		}

		const orderDirection = filters?.sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

		const [levels, count] = await this.levelsRepo.findAndCount({
			take: limit,
			skip,
			where,
			order: {
				minExperience: orderDirection,
				id: orderDirection,
			},
		});

		return [levels.map(l => this.toModel(l)), count];
	}

	async findLowestLevel(): Promise<LevelType | null> {
		const lowest = await this.levelsRepo.findOne({
			where: {},
			order: {
				minExperience: 'ASC',
				id: 'ASC',
			},
		});
		return lowest ? this.toModel(lowest) : null;
	}

	async createLevel(data: CreateLevelType): Promise<LevelType> {
		const level = this.levelsRepo.create({
			name: data.name,
			image: data.image,
			minExperience: data.minExperience,
			coins: data.coins,
			roomId: data.roomId ?? undefined,
		});
		const saved = await this.levelsRepo.save(level);
		return this.toModel(saved);
	}

	async updateLevel(id: number, data: UpdateLevelType): Promise<LevelType | null> {
		const level = await this.levelsRepo.findOne({
			where: { id },
		});
		if (!level) {
			return null;
		}

		Object.assign(level, data);
		const saved = await this.levelsRepo.save(level);
		return this.toModel(saved);
	}

	private toModel(entity: LevelsEntity): LevelType {
		return {
			id: entity.id,
			name: entity.name,
			image: entity.image,
			minExperience: entity.minExperience,
			coins: entity.coins,
			roomId: entity.roomId ?? undefined,
		};
	}
}
