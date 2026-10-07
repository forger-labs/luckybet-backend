import type { ChestBasic, FilterChestDTO } from '../../app/dto/chest.schema';
import { ChestPeriodType } from '../../app/enums';

export type CreateChestInput = {
	title: string;
	description?: string;
	periodType: ChestPeriodType;
	requiredMissions: number;
	coinsAmount: number;
	roomId?: number | null;
	experiencePoints: number;
	imageUrl?: string | null;
	isActive?: boolean;
};

export type UpdateChestInput = Partial<CreateChestInput>;

export interface ForDatabaseChests {
	createChest(data: CreateChestInput): Promise<ChestBasic>;

	findById(id: number): Promise<ChestBasic | null>;

	updateChest(id: number, data: UpdateChestInput): Promise<ChestBasic | null>;

	getChests(filter: FilterChestDTO): Promise<[ChestBasic[], number]>;
}
