import type {
	ChestSummaryItem,
	ChestsSummary,
	LevelDistributionItem,
	LevelsDistribution,
	MissionsEngagement,
} from '../../app/dto/statistics-engagement.schema';
import type { DateRangeFilter } from '../../app/dto/statistics-filter.schema';
import type {
	LeaderboardEntry,
} from '../../app/dto/statistics-leaderboard.schema';
import type {
	OperationalRisk,
	ReviewersSla,
} from '../../app/dto/statistics-operational.schema';

export type DatabaseCoinsSummary = {
	missionsCoins: number;
	levelsCoins: number;
	chestsCoins: number;
	totalCoins: number;
};

export type DatabaseEventsCount = {
	completedMissionsCount: number;
	levelUpsCount: number;
	claimedChestsCount: number;
};

export type DatabaseLiabilities = {
	missionsPendingCoins: number;
	levelsPendingCoins: number;
	chestsPendingCoins: number;
	pendingCoins: number;
	claimedCoins: number;
	pendingClaimsCount: number;
};

export interface ForDatabaseStatistics {
	getCoinsSummary(filter?: DateRangeFilter): Promise<DatabaseCoinsSummary>;
	getEventsCount(filter?: DateRangeFilter): Promise<DatabaseEventsCount>;
	getLiabilities(filter?: DateRangeFilter): Promise<DatabaseLiabilities>;
	getOperationalRisk(filter?: DateRangeFilter): Promise<OperationalRisk>;
	getReviewersSla(filter?: DateRangeFilter): Promise<ReviewersSla>;
	getMissionsEngagement(filter?: DateRangeFilter): Promise<MissionsEngagement>;
	getLevelsDistribution(): Promise<LevelsDistribution>;
	getChestsSummary(periodKey?: string): Promise<ChestsSummary>;
	getLeaderboard(
		limit: number,
		dateRange?: { startDate: Date; endDate: Date },
	): Promise<LeaderboardEntry[]>;
}
