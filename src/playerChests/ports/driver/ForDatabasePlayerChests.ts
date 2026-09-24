import type { UserMissionChestBasic } from '../../app/dto/player-chest.schema';
import type { RewardStatus } from '../../../rewards/app/enums';

export type CreateUserChestInput = {
	playerId: number;
	chestId: number;
	periodKey: string;
	completedMissionsCount: number;
};

export interface ForDatabasePlayerChests {
	findByPlayerAndPeriod(
		playerId: number,
		chestId: number,
		periodKey: string,
	): Promise<UserMissionChestBasic | null>;

	findById(id: number): Promise<UserMissionChestBasic | null>;

	acquireClaimLock(
		data: CreateUserChestInput,
	): Promise<UserMissionChestBasic | null>;

	updateStatus(
		id: number,
		status: RewardStatus,
		options?: {
			externalOperationId?: string | null;
			errorMessage?: string | null;
			resolvedByAdminId?: number | null;
			claimedAt?: Date | null;
		},
	): Promise<UserMissionChestBasic>;

	findUncertainClaims(params?: {
		take?: number;
		skip?: number;
	}): Promise<[UserMissionChestBasic[], number]>;
}
