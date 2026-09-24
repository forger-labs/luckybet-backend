import type { MissionRewardBasic } from '../../app/dto/reward.schema';
import { RewardStatus } from '../../app/enums';

export type CreateMissionRewardInput = {
	userMissionId: number;
	playerId: number;
	coinsAmount: number;
	experiencePoints: number;
};

export interface ForDatabaseMissionRewards {
	createReward(data: CreateMissionRewardInput): Promise<MissionRewardBasic>;

	findByUserMissionId(userMissionId: number): Promise<MissionRewardBasic | null>;

	findById(id: number): Promise<MissionRewardBasic | null>;

	findPendingByPlayer(playerId: number): Promise<MissionRewardBasic[]>;

	findUncertainRewards(params?: { take?: number; skip?: number }): Promise<[MissionRewardBasic[], number]>;

	acquireProcessingLock(
		userMissionId: number,
		allowedStatuses?: RewardStatus[],
	): Promise<MissionRewardBasic | null>;

	updateStatus(
		id: number,
		status: RewardStatus,
		options?: {
			externalOperationId?: string | null;
			errorMessage?: string | null;
			claimedAt?: Date | null;
		},
	): Promise<MissionRewardBasic>;
}
