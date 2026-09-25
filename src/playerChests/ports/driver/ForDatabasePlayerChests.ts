import type { RewardStatus } from '../../../rewards/app/enums';
import type {
	PlayerChestFilter,
	UserMissionChestBasic,
} from '../../app/dto/player-chest.schema';

export type CreateUserChestInput = {
	playerId: number;
	chestId: number;
	periodKey: string;
	completedMissionsCount: number;
	coinsAmount: number;
	roomId?: number | null;
	status?: RewardStatus;
};

export interface ForDatabasePlayerChests {
	findByPlayerAndPeriod(
		playerId: number,
		chestId: number,
		periodKey: string,
	): Promise<UserMissionChestBasic | null>;

	findById(id: number): Promise<UserMissionChestBasic | null>;

	acquireClaimLock(data: CreateUserChestInput): Promise<UserMissionChestBasic | null>;

	updateStatus(
		id: number,
		status: RewardStatus,
		options?: {
			externalOperationId?: string | null;
			errorMessage?: string | null;
			resolvedByAdminId?: number | null;
			claimedAt?: Date | null;
			completedMissionsCount?: number;
		},
	): Promise<UserMissionChestBasic>;

	getPlayerChests(
		playerId: number,
		filter: PlayerChestFilter,
	): Promise<[UserMissionChestBasic[], number]>;

	findUncertainClaims(params?: {
		take?: number;
		skip?: number;
	}): Promise<[UserMissionChestBasic[], number]>;
}
