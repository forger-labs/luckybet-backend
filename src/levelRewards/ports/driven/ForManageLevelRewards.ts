import type { RewardAction } from '../../../rewards/app/enums';
import type {
	LevelRewardBasic,
	LevelRewardFilter,
} from '../../app/dto/level-reward.schema';

export interface ForManageLevelRewards {
	claimLevelReward(levelId: number, playerId: number): Promise<LevelRewardBasic>;

	listPlayerRewards(
		playerId: number,
		filter: LevelRewardFilter,
	): Promise<{
		rewards: LevelRewardBasic[];
		total: number;
		limit: number;
		skip: number;
	}>;

	getUncertainClaims(params?: { take?: number; skip?: number }): Promise<{
		claims: LevelRewardBasic[];
		total: number;
		limit: number;
		skip: number;
	}>;

	resolveUncertainClaim(
		claimId: number,
		action: RewardAction,
		adminId: number,
		options?: { externalOperationId?: string; adminNotes?: string },
	): Promise<LevelRewardBasic>;
}
