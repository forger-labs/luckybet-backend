import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { ForCache } from '@/src/shared/cache/ports/forCache.port';
import type { StorageService, UploadableFile } from '@/src/shared/storage/storage.port';
import type { ForManageLevels } from '../ports/drivens/forManageLevels';
import type { ForDatabaseLevels } from '../ports/drivers/forDatabaseLevels';
import {
	DEFAULT_LOWEST_LEVEL_CACHE_TTL_SECONDS,
	LUCKYBET_LOWEST_LEVEL_CACHE_KEY,
} from './constants';
import type {
	CreateLevelMultipart,
	LevelsFilter,
	LevelType,
	UpdateLevelMultipart,
} from './dto/level.schema';

export class LevelsCore implements ForManageLevels {
	constructor(
		private readonly levelsRepo: ForDatabaseLevels,
		private readonly cache: ForCache,
		private readonly storage: StorageService,
	) {}

	private toPublicUrl(key: string | null | undefined): string {
		if (!key) return '';
		return this.storage.buildPublicUrl(key);
	}

	private validateImageFile(file: UploadableFile): void {
		if (!file.filename?.trim()) {
			throw new BadRequestException('El archivo de imagen debe tener un nombre');
		}
		const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
		if (!allowedMimes.includes(file.mimetype)) {
			throw new BadRequestException('Solo se permiten imágenes JPEG, PNG o WebP');
		}
		if (file.buffer.length > 5 * 1024 * 1024) {
			throw new BadRequestException('La imagen no puede superar los 5 MiB');
		}
	}

	async createLevel(data: CreateLevelMultipart): Promise<LevelType> {
		if (data.minExperience < 0) {
			throw new BadRequestException('La experiencia mínima no puede ser negativa');
		}
		if (data.coins < 0) {
			throw new BadRequestException('Las fichas no pueden ser negativas');
		}

		this.validateImageFile(data.image);

		const imageKey = await this.storage.uploadImage(data.image, 'levels');

		try {
			const created = await this.levelsRepo.createLevel({
				name: data.name,
				minExperience: data.minExperience,
				coins: data.coins,
				roomId: data.roomId,
				image: imageKey,
			});

			// Invalidate lowest level cache in Redis
			await this.cache.del(LUCKYBET_LOWEST_LEVEL_CACHE_KEY);

			return {
				...created,
				image: this.toPublicUrl(created.image),
			};
		} catch (error) {
			// Cleanup: avoid orphan image in storage if DB write fails
			await this.storage.deleteImage(imageKey).catch(() => undefined);
			throw error;
		}
	}

	async updateLevel(id: number, data: UpdateLevelMultipart): Promise<LevelType> {
		if (data.minExperience !== undefined && data.minExperience < 0) {
			throw new BadRequestException('La experiencia mínima no puede ser negativa');
		}
		if (data.coins !== undefined && data.coins < 0) {
			throw new BadRequestException('Las fichas no pueden ser negativas');
		}

		const existing = await this.levelsRepo.findById(id);
		if (!existing) {
			throw new NotFoundException(`Nivel con ID ${id} no encontrado`);
		}

		let imageKey = existing.image;
		if (data.image) {
			this.validateImageFile(data.image);
			imageKey = await this.storage.replaceImage(data.image, 'levels', existing.image);
		}

		const updated = await this.levelsRepo.updateLevel(id, {
			name: data.name,
			minExperience: data.minExperience,
			coins: data.coins,
			roomId: data.roomId,
			image: imageKey,
		});

		if (!updated) {
			throw new NotFoundException(`Nivel con ID ${id} no encontrado`);
		}

		// Invalidate lowest level cache in Redis
		await this.cache.del(LUCKYBET_LOWEST_LEVEL_CACHE_KEY);

		return {
			...updated,
			image: this.toPublicUrl(updated.image),
		};
	}

	async getLevelById(id: number): Promise<LevelType> {
		const level = await this.levelsRepo.findById(id);
		if (!level) {
			throw new NotFoundException(`Nivel con ID ${id} no encontrado`);
		}
		return {
			...level,
			image: this.toPublicUrl(level.image),
		};
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
			levels: levels.map(l => ({
				...l,
				image: this.toPublicUrl(l.image),
			})),
			total,
			limit: take,
			skip,
		};
	}

	async getLowestLevel(): Promise<LevelType | null> {
		// 1. Check Redis cache first
		const cached = await this.cache.get<LevelType>(LUCKYBET_LOWEST_LEVEL_CACHE_KEY);
		if (cached) {
			return {
				...cached,
				image: this.toPublicUrl(cached.image),
			};
		}

		// 2. Fetch from database
		const lowest = await this.levelsRepo.findLowestLevel();
		if (lowest) {
			await this.cache.set(
				LUCKYBET_LOWEST_LEVEL_CACHE_KEY,
				lowest,
				DEFAULT_LOWEST_LEVEL_CACHE_TTL_SECONDS,
			);
			return {
				...lowest,
				image: this.toPublicUrl(lowest.image),
			};
		}

		return null;
	}
}
