import type { RewardAction } from '../../../rewards/app/enums';
import type {
	PlayerChestFilter,
	PlayerChestProgress,
	PlayerChestProgressFilter,
	UserMissionChestBasic,
} from '../../app/dto/player-chest.schema';

export interface ForManagePlayerChests {
	getPlayerChestsProgress(
		playerId: number,
		filter?: PlayerChestProgressFilter,
	): Promise<PlayerChestProgress[]>;

	getChestProgressById(chestId: number, playerId: number): Promise<PlayerChestProgress>;

	joinChest(chestId: number, playerId: number): Promise<UserMissionChestBasic>;

	listPlayerChests(
		playerId: number,
		filter: PlayerChestFilter,
	): Promise<{
		claims: UserMissionChestBasic[];
		total: number;
		limit: number;
		skip: number;
	}>;

	listAllChests(filter: PlayerChestFilter): Promise<{
		claims: UserMissionChestBasic[];
		total: number;
		limit: number;
		skip: number;
	}>;

	claimChest(chestId: number, playerId: number): Promise<UserMissionChestBasic>;

	resolveUncertainClaim(
		claimId: number,
		action: RewardAction,
		adminId: number,
		options?: { externalOperationId?: string; adminNotes?: string },
	): Promise<UserMissionChestBasic>;
}
