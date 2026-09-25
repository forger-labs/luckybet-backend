import type { RewardAction } from '../../../rewards/app/enums';
import type {
	PlayerChestFilter,
	PlayerChestProgress,
	UserMissionChestBasic,
} from '../../app/dto/player-chest.schema';

export interface ForManagePlayerChests {
	getPlayerChestsProgress(playerId: number): Promise<PlayerChestProgress[]>;

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

	claimChest(chestId: number, playerId: number): Promise<UserMissionChestBasic>;

	getUncertainClaims(params?: { take?: number; skip?: number }): Promise<{
		claims: UserMissionChestBasic[];
		total: number;
		limit: number;
		skip: number;
	}>;

	resolveUncertainClaim(
		claimId: number,
		action: RewardAction,
		adminId: number,
		options?: { externalOperationId?: string; adminNotes?: string },
	): Promise<UserMissionChestBasic>;
}
