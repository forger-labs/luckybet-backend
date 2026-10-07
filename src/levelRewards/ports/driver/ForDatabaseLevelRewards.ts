import type { RewardStatus } from '../../../rewards/app/enums';
import type {
	LevelRewardBasic,
	LevelRewardFilter,
} from '../../app/dto/level-reward.schema';

export type CreateLevelRewardInput = {
	playerId: number;
	levelId: number;
	coinsAmount: number;
	roomId?: number | null;
	status?: RewardStatus;
};

export interface ForDatabaseLevelRewards {
	createReward(data: CreateLevelRewardInput): Promise<LevelRewardBasic>;

	findByPlayerAndLevel(
		playerId: number,
		levelId: number,
	): Promise<LevelRewardBasic | null>;

	findById(id: number): Promise<LevelRewardBasic | null>;

	acquireClaimLock(data: CreateLevelRewardInput): Promise<LevelRewardBasic | null>;

	updateStatus(
		id: number,
		status: RewardStatus,
		options?: {
			externalOperationId?: string | null;
			errorMessage?: string | null;
			resolvedByAdminId?: number | null;
			claimedAt?: Date | null;
		},
	): Promise<LevelRewardBasic>;

	getPlayerRewards(
		filter?: LevelRewardFilter,
		overridePlayerId?: number,
	): Promise<[LevelRewardBasic[], number]>;
}
