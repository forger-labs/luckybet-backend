import type { MissionRewardBasic } from '../../app/dto/reward.schema';
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

	getPendingRewards(playerId: number): Promise<MissionRewardBasic[]>;

	getUncertainRewards(params?: { take?: number; skip?: number }): Promise<{
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
