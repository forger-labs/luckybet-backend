import type { UploadableFile } from '../../../shared/storage/storage.port';
import type {
	ChestBasic,
	CreateChestDto,
	FilterChestDTO,
	UpdateChestDto,
} from '../../app/dto/chest.schema';
import type { ChestPeriodType } from '../../app/enums';

export interface ForManageChests {
	createChest(dto: CreateChestDto, image?: UploadableFile): Promise<ChestBasic>;

	getChest(id: number): Promise<ChestBasic>;

	updateChest(id: number, dto: UpdateChestDto): Promise<ChestBasic>;

	replaceChestImage(id: number, file: UploadableFile): Promise<ChestBasic>;

	deleteChestImage(id: number): Promise<ChestBasic>;

	toggleChestActive(id: number, isActive: boolean): Promise<ChestBasic>;

	listChests(
		filter: FilterChestDTO,
	): Promise<{ chests: ChestBasic[]; total: number; limit: number; skip: number }>;
}
