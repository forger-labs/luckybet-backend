import type { MissionRewardBasic, RewardFilter } from '../../app/dto/reward.schema';
import type { RewardAction } from '../../app/enums';

export interface ForManageRewards {
	createReward(data: {
		userMissionId: number;
		playerId: number;
		coinsAmount: number;
		roomId?: number | null;
		experiencePoints: number;
	}): Promise<MissionRewardBasic>;

	claimReward(userMissionId: number, playerId: number): Promise<MissionRewardBasic>;

	listPlayerRewards(
		playerId: number,
		filter?: RewardFilter,
	): Promise<{
		rewards: MissionRewardBasic[];
		total: number;
		limit: number;
		skip: number;
	}>;

	listAllRewards(filter?: RewardFilter): Promise<{
		rewards: MissionRewardBasic[];
		total: number;
		limit: number;
		skip: number;
	}>;

	resolveUncertainReward(
		rewardId: number,
		action: RewardAction,
		adminId: number,
		options?: { externalOperationId?: string; adminNotes?: string },
	): Promise<MissionRewardBasic>;
}
