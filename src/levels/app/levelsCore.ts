import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { ForCache } from '@/src/shared/cache/ports/forCache.port';
import type { ForManageLevels } from '../ports/drivens/forManageLevels';
import type { ForDatabaseLevels } from '../ports/drivers/forDatabaseLevels';
import {
	DEFAULT_LOWEST_LEVEL_CACHE_TTL_SECONDS,
	LUCKYBET_LOWEST_LEVEL_CACHE_KEY,
} from './constants';
import type {
	CreateLevelType,
	LevelsFilter,
	LevelType,
	UpdateLevelType,
} from './dto/level.schema';

export class LevelsCore implements ForManageLevels {
	constructor(
		private readonly levelsRepo: ForDatabaseLevels,
		private readonly cache: ForCache,
	) {}

	async createLevel(data: CreateLevelType): Promise<LevelType> {
		if (data.minExperience < 0) {
			throw new BadRequestException('La experiencia mínima no puede ser negativa');
		}
		if (data.coins < 0) {
			throw new BadRequestException('Las fichas no pueden ser negativas');
		}

		const created = await this.levelsRepo.createLevel(data);

		// Invalidate lowest level cache in Redis
		await this.cache.del(LUCKYBET_LOWEST_LEVEL_CACHE_KEY);

		return created;
	}

	async updateLevel(id: number, data: UpdateLevelType): Promise<LevelType> {
		if (data.minExperience !== undefined && data.minExperience < 0) {
			throw new BadRequestException('La experiencia mínima no puede ser negativa');
		}
		if (data.coins !== undefined && data.coins < 0) {
			throw new BadRequestException('Las fichas no pueden ser negativas');
		}

		const updated = await this.levelsRepo.updateLevel(id, data);
		if (!updated) {
			throw new NotFoundException(`Nivel con ID ${id} no encontrado`);
		}

		// Invalidate lowest level cache in Redis
		await this.cache.del(LUCKYBET_LOWEST_LEVEL_CACHE_KEY);

		return updated;
	}

	async getLevelById(id: number): Promise<LevelType> {
		const level = await this.levelsRepo.findById(id);
		if (!level) {
			throw new NotFoundException(`Nivel con ID ${id} no encontrado`);
		}
		return level;
	}

	async getLevels({
		take = 100,
		skip = 0,
		filter,
	}: {
		take?: number;
		skip?: number;
		filter?: LevelsFilter;
	}): Promise<{
		levels: LevelType[];
		total: number;
		limit: number;
		skip: number;
	}> {
		const [levels, total] = await this.levelsRepo.findAll(take, skip, filter);
		return {
			levels,
			total,
			limit: take,
			skip,
		};
	}

	async getLowestLevel(): Promise<LevelType | null> {
		// 1. Check Redis cache first
		const cached = await this.cache.get<LevelType>(LUCKYBET_LOWEST_LEVEL_CACHE_KEY);
		if (cached) {
			return cached;
		}

		// 2. Fetch from database
		const lowest = await this.levelsRepo.findLowestLevel();
		if (lowest) {
			await this.cache.set(
				LUCKYBET_LOWEST_LEVEL_CACHE_KEY,
				lowest,
				DEFAULT_LOWEST_LEVEL_CACHE_TTL_SECONDS,
			);
		}

		return lowest;
	}
}
