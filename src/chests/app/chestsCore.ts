import {
	BadRequestException,
	Inject,
	Injectable,
	NotFoundException,
} from '@nestjs/common';

import { STORAGE_SERVICE } from '../../shared/storage/storage.constants';
import type { StorageService, UploadableFile } from '../../shared/storage/storage.port';
import type { ForManageChests } from '../ports/driven/ForManageChests';
import type { ForDatabaseChests } from '../ports/driver/ForDatabaseChests';
import { FOR_DATABASE_CHESTS } from './constants';
import type { ChestBasic, CreateChestDto, UpdateChestDto } from './dto/chest.schema';
import type { ChestPeriodType } from './enums';

@Injectable()
export class ChestsCore implements ForManageChests {
	constructor(
		@Inject(FOR_DATABASE_CHESTS)
		private readonly chestRepo: ForDatabaseChests,
		@Inject(STORAGE_SERVICE)
		private readonly storage: StorageService,
	) {}

	private toPublicUrl(key: string | null | undefined): string | undefined {
		return key ? this.storage.buildPublicUrl(key) : undefined;
	}

	async createChest(dto: CreateChestDto, image?: UploadableFile): Promise<ChestBasic> {
		let imageUrl: string | undefined;

		if (image) {
			this.validateImageFile(image);
			imageUrl = await this.storage.uploadImage(image, 'missions');
		}

		try {
			const chest = await this.chestRepo.createChest({
				coinsAmount: dto.coinsAmount,
				roomId: dto.roomId,
				experiencePoints: dto.experiencePoints,
				periodType: dto.periodType as ChestPeriodType,
				requiredMissions: dto.requiredMissions,
				title: dto.title,
				description: dto.description,
				isActive: dto.isActive,
				imageUrl,
			});
			return {
				...chest,
				imageUrl: this.toPublicUrl(chest.imageUrl),
			};
		} catch (error) {
			if (imageUrl) {
				await this.storage.deleteImage(imageUrl).catch(() => undefined);
			}
			throw error;
		}
	}

	async getChest(id: number): Promise<ChestBasic> {
		const chest = await this.chestRepo.findById(id);
		if (!chest) {
			throw new NotFoundException('Cofre no encontrado');
		}
		return {
			...chest,
			imageUrl: this.toPublicUrl(chest.imageUrl),
		};
	}

	async updateChest(id: number, dto: UpdateChestDto): Promise<ChestBasic> {
		const existing = await this.chestRepo.findById(id);
		if (!existing) {
			throw new NotFoundException('Cofre no encontrado');
		}

		const updated = await this.chestRepo.updateChest(id, dto);
		if (!updated) {
			throw new NotFoundException('Cofre no encontrado');
		}
		return {
			...updated,
			imageUrl: this.toPublicUrl(updated.imageUrl),
		};
	}

	async replaceChestImage(id: number, file: UploadableFile): Promise<ChestBasic> {
		const existing = await this.chestRepo.findById(id);
		if (!existing) {
			throw new NotFoundException('Cofre no encontrado');
		}

		this.validateImageFile(file);
		const newUrl = await this.storage.replaceImage(
			file,
			'missions',
			existing.imageUrl ?? '',
		);

		const updated = await this.chestRepo.updateChest(id, { imageUrl: newUrl });
		if (!updated) throw new NotFoundException('Cofre no encontrado');

		return {
			...updated,
			imageUrl: this.toPublicUrl(updated.imageUrl),
		};
	}

	async deleteChestImage(id: number): Promise<ChestBasic> {
		const existing = await this.chestRepo.findById(id);
		if (!existing) {
			throw new NotFoundException('Cofre no encontrado');
		}

		if (existing.imageUrl) {
			await this.storage.deleteImage(existing.imageUrl);
		}

		const updated = await this.chestRepo.updateChest(id, { imageUrl: null });
		if (!updated) throw new NotFoundException('Cofre no encontrado');

		return {
			...updated,
			imageUrl: undefined,
		};
	}

	async toggleChestActive(id: number, isActive: boolean): Promise<ChestBasic> {
		const updated = await this.chestRepo.updateChest(id, { isActive });
		if (!updated) {
			throw new NotFoundException('Cofre no encontrado');
		}
		return {
			...updated,
			imageUrl: this.toPublicUrl(updated.imageUrl),
		};
	}

	async listChests(params: {
		take?: number;
		skip?: number;
		periodType?: ChestPeriodType;
		isActive?: boolean;
	}): Promise<{
		chests: ChestBasic[];
		total: number;
		limit: number;
		skip: number;
	}> {
		const [chests, total] = await this.chestRepo.getChests({
			take: params.take ?? 100,
			skip: params.skip ?? 0,
			periodType: params.periodType,
			isActive: params.isActive,
		});
		return {
			chests: chests.map(c => ({
				...c,
				imageUrl: this.toPublicUrl(c.imageUrl),
			})),
			total,
			limit: params.take ?? 50,
			skip: params.skip ?? 0,
		};
	}

	private validateImageFile(file: UploadableFile): void {
		if (!file.filename.trim()) {
			throw new BadRequestException('El archivo debe tener un nombre');
		}
		if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
			throw new BadRequestException('Solo se permiten imagenes JPEG o PNG');
		}
		if (file.buffer.length > 5 * 1024 * 1024) {
			throw new BadRequestException('La imagen no puede superar los 5 MiB');
		}
	}
}
