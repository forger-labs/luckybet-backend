import type {
	ChestSummaryFilter,
	ChestsSummary,
	LevelsDistribution,
	MissionsEngagement,
} from '../../app/dto/statistics-engagement.schema';
import type { DateRangeFilter } from '../../app/dto/statistics-filter.schema';
import type {
	LeaderboardFilter,
	LeaderboardResult,
} from '../../app/dto/statistics-leaderboard.schema';
import type { StatisticsLiabilities } from '../../app/dto/statistics-liabilities.schema';
import type {
	OperationalRisk,
	ReviewersSla,
} from '../../app/dto/statistics-operational.schema';
import type { StatisticsSummary } from '../../app/dto/statistics-summary.schema';

export interface ForManageStatistics {
	getSummary(filter?: DateRangeFilter): Promise<StatisticsSummary>;
	getLiabilities(filter?: DateRangeFilter): Promise<StatisticsLiabilities>;
	getOperationalRisk(filter?: DateRangeFilter): Promise<OperationalRisk>;
	getReviewersSla(filter?: DateRangeFilter): Promise<ReviewersSla>;
	getMissionsEngagement(filter?: DateRangeFilter): Promise<MissionsEngagement>;
	getLevelsDistribution(): Promise<LevelsDistribution>;
	getChestsSummary(filter?: ChestSummaryFilter): Promise<ChestsSummary>;
	getLeaderboard(filter?: LeaderboardFilter): Promise<LeaderboardResult>;
}
