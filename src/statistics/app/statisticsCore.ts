import { Inject, Injectable } from '@nestjs/common';

import { getPeriodRange } from '@/src/shared/utils/date.util';
import type { ForManageStatistics } from '../ports/driven/forManageStatistics';
import type { ForDatabaseStatistics } from '../ports/driver/forDatabaseStatistics';
import { STATISTICS_REPO_PROVIDER } from './constants';
import type {
	ChestSummaryFilter,
	ChestsSummary,
	LevelsDistribution,
	MissionsEngagement,
} from './dto/statistics-engagement.schema';
import type { DateRangeFilter } from './dto/statistics-filter.schema';
import {
	type LeaderboardFilter,
	LeaderboardPeriod,
	type LeaderboardResult,
} from './dto/statistics-leaderboard.schema';
import type { StatisticsLiabilities } from './dto/statistics-liabilities.schema';
import type { OperationalRisk, ReviewersSla } from './dto/statistics-operational.schema';
import type { StatisticsSummary } from './dto/statistics-summary.schema';

@Injectable()
export class StatisticsCore implements ForManageStatistics {
	constructor(
		@Inject(STATISTICS_REPO_PROVIDER)
		private readonly repo: ForDatabaseStatistics,
	) {}

	async getSummary(filter?: DateRangeFilter): Promise<StatisticsSummary> {
		const [coins, events] = await Promise.all([
			this.repo.getCoinsSummary(filter),
			this.repo.getEventsCount(filter),
		]);

		return {
			coinsBreakdown: {
				missionsCoins: coins.missionsCoins,
				levelsCoins: coins.levelsCoins,
				chestsCoins: coins.chestsCoins,
				totalCoins: coins.totalCoins,
			},
			eventsCount: {
				completedMissionsCount: events.completedMissionsCount,
				levelUpsCount: events.levelUpsCount,
				claimedChestsCount: events.claimedChestsCount,
			},
		};
	}

	async getLiabilities(filter?: DateRangeFilter): Promise<StatisticsLiabilities> {
		const data = await this.repo.getLiabilities(filter);
		const totalCoins = data.claimedCoins + data.pendingCoins;
		const claimRate =
			totalCoins > 0 ? Math.round((data.claimedCoins / totalCoins) * 10_000) / 100 : 0;

		return {
			pendingCoins: data.pendingCoins,
			claimedCoins: data.claimedCoins,
			claimRate,
			pendingClaimsCount: data.pendingClaimsCount,
			breakdown: {
				missionsPendingCoins: data.missionsPendingCoins,
				levelsPendingCoins: data.levelsPendingCoins,
				chestsPendingCoins: data.chestsPendingCoins,
			},
		};
	}

	async getOperationalRisk(filter?: DateRangeFilter): Promise<OperationalRisk> {
		return await this.repo.getOperationalRisk(filter);
	}

	async getReviewersSla(filter?: DateRangeFilter): Promise<ReviewersSla> {
		return await this.repo.getReviewersSla(filter);
	}

	async getMissionsEngagement(filter?: DateRangeFilter): Promise<MissionsEngagement> {
		return await this.repo.getMissionsEngagement(filter);
	}

	async getLevelsDistribution(): Promise<LevelsDistribution> {
		return await this.repo.getLevelsDistribution();
	}

	async getChestsSummary(filter?: ChestSummaryFilter): Promise<ChestsSummary> {
		return await this.repo.getChestsSummary(filter?.periodKey);
	}

	async getLeaderboard(filter?: LeaderboardFilter): Promise<LeaderboardResult> {
		const period = filter?.period ?? LeaderboardPeriod.ALL_TIME;
		const limit = filter?.limit ?? 20;

		let dateRange: { startDate: Date; endDate: Date } | undefined;

		if (period === LeaderboardPeriod.WEEKLY) {
			const range = getPeriodRange('WEEKLY');
			dateRange = { startDate: range.startDate, endDate: range.endDate };
		} else if (period === LeaderboardPeriod.MONTHLY) {
			const range = getPeriodRange('MONTHLY');
			dateRange = { startDate: range.startDate, endDate: range.endDate };
		}

		const entries = await this.repo.getLeaderboard(limit, dateRange);

		return {
			period,
			startDate: dateRange?.startDate ? dateRange.startDate.toISOString() : null,
			endDate: dateRange?.endDate ? dateRange.endDate.toISOString() : null,
			leaderboard: entries,
		};
	}
}
