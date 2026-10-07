import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type ObjectLiteral, Repository, type SelectQueryBuilder } from 'typeorm';

import {
	DEFAULT_TIMEZONE,
	getWeeklyPeriodKey,
	parseDateInTz,
} from '@/src/shared/utils/date.util';
import { MissionChest } from '../../../chests/app/entities/mission-chest.entity';
import { LevelReward } from '../../../levelRewards/app/entities/level-reward.entity';
import { LevelsEntity } from '../../../levels/app/entities/levels.entity';
import { UserMission } from '../../../misiones/app/entities/user-mission.entity';
import { UserMissionStep } from '../../../misiones/app/entities/user-mission-step.entity';
import { StepStatus, UserMissionStatus } from '../../../misiones/app/enums';
import { UserMissionChest } from '../../../playerChests/app/entities/user-mission-chest.entity';
import { Player } from '../../../players/app/entities/player.entity';
import { MissionReward } from '../../../rewards/app/entities/mission-reward.entity';
import { RewardStatus } from '../../../rewards/app/enums';
import type {
	ChestSummaryItem,
	ChestsSummary,
	LevelDistributionItem,
	LevelsDistribution,
	MissionsEngagement,
} from '../../app/dto/statistics-engagement.schema';
import type { DateRangeFilter } from '../../app/dto/statistics-filter.schema';
import type { LeaderboardEntry } from '../../app/dto/statistics-leaderboard.schema';
import type {
	OperationalRisk,
	ReviewerSlaItem,
	ReviewersSla,
} from '../../app/dto/statistics-operational.schema';
import type {
	DatabaseCoinsSummary,
	DatabaseEventsCount,
	DatabaseLiabilities,
	ForDatabaseStatistics,
} from '../../ports/driver/forDatabaseStatistics';

interface RawLeaderboardRow {
	playerId: string | number;
	username: string;
	totalCoins: string | number;
	missionsCoins: string | number;
	levelsCoins: string | number;
	chestsCoins: string | number;
}

@Injectable()
export class StatisticsRepoService implements ForDatabaseStatistics {
	constructor(
		@InjectRepository(MissionReward)
		private readonly missionRewardRepo: Repository<MissionReward>,
		@InjectRepository(LevelReward)
		private readonly levelRewardRepo: Repository<LevelReward>,
		@InjectRepository(UserMissionChest)
		private readonly userMissionChestRepo: Repository<UserMissionChest>,
		@InjectRepository(UserMission)
		private readonly userMissionRepo: Repository<UserMission>,
		@InjectRepository(UserMissionStep)
		private readonly userMissionStepRepo: Repository<UserMissionStep>,
		@InjectRepository(MissionChest)
		private readonly missionChestRepo: Repository<MissionChest>,
		@InjectRepository(Player)
		private readonly playerRepo: Repository<Player>,
		@InjectRepository(LevelsEntity)
		private readonly levelsRepo: Repository<LevelsEntity>,
	) {}

	private applyDateRange<T extends ObjectLiteral>(
		qb: SelectQueryBuilder<T>,
		dateColumn: string,
		filter?: DateRangeFilter,
	): void {
		if (filter?.startDate) {
			qb.andWhere(`${dateColumn} >= :startDate`, {
				startDate: parseDateInTz(filter.startDate, DEFAULT_TIMEZONE, false),
			});
		}
		if (filter?.endDate) {
			qb.andWhere(`${dateColumn} <= :endDate`, {
				endDate: parseDateInTz(filter.endDate, DEFAULT_TIMEZONE, true),
			});
		}
	}

	async getCoinsSummary(filter?: DateRangeFilter): Promise<DatabaseCoinsSummary> {
		// 1. Mission Rewards Coins
		const missionQb = this.missionRewardRepo
			.createQueryBuilder('mr')
			.select('COALESCE(SUM(mr.coins_amount), 0)', 'total')
			.where('mr.status = :status', { status: RewardStatus.CLAIMED });
		this.applyDateRange(missionQb, 'mr.claimed_at', filter);
		const missionRaw = await missionQb.getRawOne<{ total: string }>();
		const missionsCoins = Number.parseInt(missionRaw?.total ?? '0', 10);

		// 2. Level Rewards Coins
		const levelQb = this.levelRewardRepo
			.createQueryBuilder('lr')
			.select('COALESCE(SUM(lr.coins_amount), 0)', 'total')
			.where('lr.status = :status', { status: RewardStatus.CLAIMED });
		this.applyDateRange(levelQb, 'lr.claimed_at', filter);
		const levelRaw = await levelQb.getRawOne<{ total: string }>();
		const levelsCoins = Number.parseInt(levelRaw?.total ?? '0', 10);

		// 3. User Mission Chests Coins
		const chestQb = this.userMissionChestRepo
			.createQueryBuilder('umc')
			.select('COALESCE(SUM(umc.coins_amount), 0)', 'total')
			.where('umc.status = :status', { status: RewardStatus.CLAIMED });
		this.applyDateRange(chestQb, 'umc.claimed_at', filter);
		const chestRaw = await chestQb.getRawOne<{ total: string }>();
		const chestsCoins = Number.parseInt(chestRaw?.total ?? '0', 10);

		const totalCoins = missionsCoins + levelsCoins + chestsCoins;

		return {
			missionsCoins,
			levelsCoins,
			chestsCoins,
			totalCoins,
		};
	}

	async getEventsCount(filter?: DateRangeFilter): Promise<DatabaseEventsCount> {
		// 1. Completed missions in date range
		const missionQb = this.userMissionRepo
			.createQueryBuilder('um')
			.select('COUNT(*)', 'count')
			.where('um.status = :status', { status: UserMissionStatus.COMPLETED });
		this.applyDateRange(missionQb, 'um.completed_at', filter);
		const missionRaw = await missionQb.getRawOne<{ count: string }>();
		const completedMissionsCount = Number.parseInt(missionRaw?.count ?? '0', 10);

		// 2. Level ups (Level rewards created in date range)
		const levelQb = this.levelRewardRepo
			.createQueryBuilder('lr')
			.select('COUNT(*)', 'count');
		this.applyDateRange(levelQb, 'lr.claimed_at', filter);
		const levelRaw = await levelQb.getRawOne<{ count: string }>();
		const levelUpsCount = Number.parseInt(levelRaw?.count ?? '0', 10);

		// 3. Claimed chests in date range
		const chestQb = this.userMissionChestRepo
			.createQueryBuilder('umc')
			.select('COUNT(*)', 'count')
			.where('umc.status = :status', { status: RewardStatus.CLAIMED });
		this.applyDateRange(chestQb, 'umc.claimed_at', filter);
		const chestRaw = await chestQb.getRawOne<{ count: string }>();
		const claimedChestsCount = Number.parseInt(chestRaw?.count ?? '0', 10);

		return {
			completedMissionsCount,
			levelUpsCount,
			claimedChestsCount,
		};
	}

	async getLiabilities(filter?: DateRangeFilter): Promise<DatabaseLiabilities> {
		// Missions PENDING & CLAIMED
		const missionPendingQb = this.missionRewardRepo
			.createQueryBuilder('mr')
			.select('COALESCE(SUM(mr.coins_amount), 0)', 'coins')
			.addSelect('COUNT(*)', 'count')
			.where('mr.status = :status', { status: RewardStatus.PENDING });
		this.applyDateRange(missionPendingQb, 'mr.created_at', filter);
		const missionPendingRaw = await missionPendingQb.getRawOne<{
			coins: string;
			count: string;
		}>();

		const missionClaimedQb = this.missionRewardRepo
			.createQueryBuilder('mr')
			.select('COALESCE(SUM(mr.coins_amount), 0)', 'coins')
			.where('mr.status = :status', { status: RewardStatus.CLAIMED });
		this.applyDateRange(
			missionClaimedQb,
			'COALESCE(mr.claimed_at, mr.created_at)',
			filter,
		);
		const missionClaimedRaw = await missionClaimedQb.getRawOne<{ coins: string }>();

		// Levels PENDING & CLAIMED
		const levelPendingQb = this.levelRewardRepo
			.createQueryBuilder('lr')
			.select('COALESCE(SUM(lr.coins_amount), 0)', 'coins')
			.addSelect('COUNT(*)', 'count')
			.where('lr.status = :status', { status: RewardStatus.PENDING });
		this.applyDateRange(levelPendingQb, 'lr.created_at', filter);
		const levelPendingRaw = await levelPendingQb.getRawOne<{
			coins: string;
			count: string;
		}>();

		const levelClaimedQb = this.levelRewardRepo
			.createQueryBuilder('lr')
			.select('COALESCE(SUM(lr.coins_amount), 0)', 'coins')
			.where('lr.status = :status', { status: RewardStatus.CLAIMED });
		this.applyDateRange(levelClaimedQb, 'COALESCE(lr.claimed_at, lr.created_at)', filter);
		const levelClaimedRaw = await levelClaimedQb.getRawOne<{ coins: string }>();

		// Chests PENDING & CLAIMED
		const chestPendingQb = this.userMissionChestRepo
			.createQueryBuilder('umc')
			.select('COALESCE(SUM(umc.coins_amount), 0)', 'coins')
			.addSelect('COUNT(*)', 'count')
			.where('umc.status = :status', { status: RewardStatus.PENDING });
		this.applyDateRange(chestPendingQb, 'umc.created_at', filter);
		const chestPendingRaw = await chestPendingQb.getRawOne<{
			coins: string;
			count: string;
		}>();

		const chestClaimedQb = this.userMissionChestRepo
			.createQueryBuilder('umc')
			.select('COALESCE(SUM(umc.coins_amount), 0)', 'coins')
			.where('umc.status = :status', { status: RewardStatus.CLAIMED });
		this.applyDateRange(
			chestClaimedQb,
			'COALESCE(umc.claimed_at, umc.created_at)',
			filter,
		);
		const chestClaimedRaw = await chestClaimedQb.getRawOne<{ coins: string }>();

		const missionsPendingCoins = Number.parseInt(missionPendingRaw?.coins ?? '0', 10);
		const levelsPendingCoins = Number.parseInt(levelPendingRaw?.coins ?? '0', 10);
		const chestsPendingCoins = Number.parseInt(chestPendingRaw?.coins ?? '0', 10);

		const pendingCoins = missionsPendingCoins + levelsPendingCoins + chestsPendingCoins;
		const claimedCoins =
			Number.parseInt(missionClaimedRaw?.coins ?? '0', 10) +
			Number.parseInt(levelClaimedRaw?.coins ?? '0', 10) +
			Number.parseInt(chestClaimedRaw?.coins ?? '0', 10);

		const pendingClaimsCount =
			Number.parseInt(missionPendingRaw?.count ?? '0', 10) +
			Number.parseInt(levelPendingRaw?.count ?? '0', 10) +
			Number.parseInt(chestPendingRaw?.count ?? '0', 10);

		return {
			missionsPendingCoins,
			levelsPendingCoins,
			chestsPendingCoins,
			pendingCoins,
			claimedCoins,
			pendingClaimsCount,
		};
	}

	async getOperationalRisk(filter?: DateRangeFilter): Promise<OperationalRisk> {
		// 1. Mission Rewards TIMEOUT_UNCERTAIN
		const missionQb = this.missionRewardRepo
			.createQueryBuilder('mr')
			.select('COUNT(*)', 'count')
			.addSelect('COALESCE(SUM(mr.coins_amount), 0)', 'coins')
			.where('mr.status = :status', { status: RewardStatus.TIMEOUT_UNCERTAIN });
		this.applyDateRange(missionQb, 'mr.updated_at', filter);
		const missionRaw = await missionQb.getRawOne<{ count: string; coins: string }>();

		// 2. Level Rewards TIMEOUT_UNCERTAIN
		const levelQb = this.levelRewardRepo
			.createQueryBuilder('lr')
			.select('COUNT(*)', 'count')
			.addSelect('COALESCE(SUM(lr.coins_amount), 0)', 'coins')
			.where('lr.status = :status', { status: RewardStatus.TIMEOUT_UNCERTAIN });
		this.applyDateRange(levelQb, 'lr.updated_at', filter);
		const levelRaw = await levelQb.getRawOne<{ count: string; coins: string }>();

		// 3. User Mission Chests TIMEOUT_UNCERTAIN
		const chestQb = this.userMissionChestRepo
			.createQueryBuilder('umc')
			.select('COUNT(*)', 'count')
			.addSelect('COALESCE(SUM(umc.coins_amount), 0)', 'coins')
			.where('umc.status = :status', { status: RewardStatus.TIMEOUT_UNCERTAIN });
		this.applyDateRange(chestQb, 'umc.updated_at', filter);
		const chestRaw = await chestQb.getRawOne<{ count: string; coins: string }>();

		const missionCount = Number.parseInt(missionRaw?.count ?? '0', 10);
		const missionCoins = Number.parseInt(missionRaw?.coins ?? '0', 10);

		const levelCount = Number.parseInt(levelRaw?.count ?? '0', 10);
		const levelCoins = Number.parseInt(levelRaw?.coins ?? '0', 10);

		const chestCount = Number.parseInt(chestRaw?.count ?? '0', 10);
		const chestCoins = Number.parseInt(chestRaw?.coins ?? '0', 10);

		const uncertainClaimsCount = missionCount + levelCount + chestCount;
		const uncertainCoinsAmount = missionCoins + levelCoins + chestCoins;

		return {
			uncertainClaimsCount,
			uncertainCoinsAmount,
			breakdown: {
				missions: {
					count: missionCount,
					coinsAmount: missionCoins,
				},
				levels: {
					count: levelCount,
					coinsAmount: levelCoins,
				},
				chests: {
					count: chestCount,
					coinsAmount: chestCoins,
				},
			},
		};
	}

	async getReviewersSla(filter?: DateRangeFilter): Promise<ReviewersSla> {
		const qb = this.userMissionStepRepo
			.createQueryBuilder('ums')
			.innerJoin('ums.reviewedBy', 'admin')
			.select('admin.id', 'adminId')
			.addSelect('admin.username', 'adminUsername')
			.addSelect('COUNT(*)', 'reviewedStepsCount')
			.addSelect(
				`SUM(CASE WHEN ums.status = '${StepStatus.APPROVED}' THEN 1 ELSE 0 END)`,
				'approvedStepsCount',
			)
			.addSelect(
				`SUM(CASE WHEN ums.status = '${StepStatus.REJECTED}' THEN 1 ELSE 0 END)`,
				'rejectedStepsCount',
			)
			.addSelect(
				'AVG(EXTRACT(EPOCH FROM (ums.reviewed_at - ums.created_at)) / 60)',
				'averageReviewTimeMinutes',
			)
			.where('ums.reviewed_by IS NOT NULL')
			.andWhere('ums.reviewed_at IS NOT NULL');

		this.applyDateRange(qb, 'ums.reviewed_at', filter);

		qb.groupBy('admin.id').addGroupBy('admin.username');

		const rawResults = await qb.getRawMany<{
			adminId: string | number;
			adminUsername: string;
			reviewedStepsCount: string;
			approvedStepsCount: string;
			rejectedStepsCount: string;
			averageReviewTimeMinutes: string | null;
		}>();

		let totalReviewedStepsCount = 0;
		let weightedMinutesSum = 0;

		const reviewers: ReviewerSlaItem[] = rawResults.map(r => {
			const count = Number.parseInt(r.reviewedStepsCount ?? '0', 10);
			const avgMin = Number.parseFloat(r.averageReviewTimeMinutes ?? '0') || 0;
			const roundedAvg = Math.round(avgMin * 100) / 100;

			totalReviewedStepsCount += count;
			weightedMinutesSum += avgMin * count;

			return {
				adminId: Number(r.adminId),
				adminUsername: r.adminUsername,
				reviewedStepsCount: count,
				approvedStepsCount: Number.parseInt(r.approvedStepsCount ?? '0', 10),
				rejectedStepsCount: Number.parseInt(r.rejectedStepsCount ?? '0', 10),
				averageReviewTimeMinutes: roundedAvg,
			};
		});

		const globalAverage =
			totalReviewedStepsCount > 0
				? Math.round((weightedMinutesSum / totalReviewedStepsCount) * 100) / 100
				: 0;

		return {
			globalAverageReviewTimeMinutes: globalAverage,
			totalReviewedStepsCount,
			reviewers,
		};
	}

	async getMissionsEngagement(filter?: DateRangeFilter): Promise<MissionsEngagement> {
		const qb = this.userMissionRepo
			.createQueryBuilder('um')
			.select(
				`SUM(CASE WHEN um.status = '${UserMissionStatus.COMPLETED}' THEN 1 ELSE 0 END)`,
				'completedCount',
			)
			.addSelect(
				`SUM(CASE WHEN um.status = '${UserMissionStatus.IN_PROGRESS}' THEN 1 ELSE 0 END)`,
				'inProgressCount',
			)
			.addSelect(
				`SUM(CASE WHEN um.status IN ('${UserMissionStatus.CANCELLED}', '${UserMissionStatus.EXPIRED}') THEN 1 ELSE 0 END)`,
				'cancelledOrExpiredCount',
			)
			.addSelect(
				`AVG(CASE WHEN um.status = '${UserMissionStatus.COMPLETED}' AND um.completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (um.completed_at - um.started_at)) / 60 ELSE NULL END)`,
				'averageCompletionMinutes',
			);

		this.applyDateRange(qb, 'um.started_at', filter);

		const raw = await qb.getRawOne<{
			completedCount: string | null;
			inProgressCount: string | null;
			cancelledOrExpiredCount: string | null;
			averageCompletionMinutes: string | null;
		}>();

		const completedCount = Number.parseInt(raw?.completedCount ?? '0', 10) || 0;
		const inProgressCount = Number.parseInt(raw?.inProgressCount ?? '0', 10) || 0;
		const cancelledOrExpiredCount =
			Number.parseInt(raw?.cancelledOrExpiredCount ?? '0', 10) || 0;
		const avgMinutes = Number.parseFloat(raw?.averageCompletionMinutes ?? '0') || 0;

		const totalStarted = completedCount + inProgressCount + cancelledOrExpiredCount;
		const completionRate =
			totalStarted > 0 ? Math.round((completedCount / totalStarted) * 10_000) / 100 : 0;

		return {
			completionRate,
			completedCount,
			inProgressCount,
			cancelledOrExpiredCount,
			averageCompletionMinutes: Math.round(avgMinutes * 100) / 100,
		};
	}

	async getLevelsDistribution(): Promise<LevelsDistribution> {
		// 1. Get all levels ordered by minExperience ASC
		const allLevels = await this.levelsRepo.find({
			order: { minExperience: 'ASC' },
		});

		// 2. Count active players by levelId
		const playersRaw = await this.playerRepo
			.createQueryBuilder('p')
			.select('p.level_id', 'levelId')
			.addSelect('COUNT(*)', 'count')
			.where('p.is_active = :isActive', { isActive: true })
			.groupBy('p.level_id')
			.getRawMany<{ levelId: string | number | null; count: string }>();

		const playerCountsByLevel = new Map<number, number>();
		let totalActivePlayers = 0;

		for (const row of playersRaw) {
			const count = Number.parseInt(row.count ?? '0', 10);
			totalActivePlayers += count;
			if (row.levelId !== null && row.levelId !== undefined) {
				playerCountsByLevel.set(Number(row.levelId), count);
			}
		}

		const distribution: LevelDistributionItem[] = allLevels.map(lvl => {
			const count = playerCountsByLevel.get(lvl.id) ?? 0;
			const percentage =
				totalActivePlayers > 0
					? Math.round((count / totalActivePlayers) * 10_000) / 100
					: 0;
			return {
				levelId: lvl.id,
				levelName: lvl.name,
				minExperience: lvl.minExperience,
				playersCount: count,
				percentage,
			};
		});

		return {
			totalActivePlayers,
			distribution,
		};
	}

	async getChestsSummary(periodKey?: string): Promise<ChestsSummary> {
		// Determine default periodKey if not provided (weekly ISO: YYYY-Www)
		let targetPeriodKey = periodKey;
		if (!targetPeriodKey) {
			const now = new Date();
			const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
			const dayNum = d.getUTCDay() || 7;
			d.setUTCDate(d.getUTCDate() + 4 - dayNum);
			const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
			const weekNo = Math.ceil(
				((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
			);
			const weekStr = String(weekNo).padStart(2, '0');
			targetPeriodKey = `${d.getUTCFullYear()}-W${weekStr}`;
		}

		const allChests = await this.missionChestRepo.find({
			where: { isActive: true },
			order: { requiredMissions: 'ASC' },
		});

		const claimsRaw = await this.userMissionChestRepo
			.createQueryBuilder('umc')
			.select('umc.chest_id', 'chestId')
			.addSelect('COUNT(*)', 'participantsCount')
			.addSelect(
				`SUM(CASE WHEN umc.status = '${RewardStatus.CLAIMED}' THEN 1 ELSE 0 END)`,
				'claimedCount',
			)
			.addSelect(
				`COALESCE(SUM(CASE WHEN umc.status = '${RewardStatus.CLAIMED}' THEN umc.coins_amount ELSE 0 END), 0)`,
				'coinsDistributed',
			)
			.where('umc.period_key = :periodKey', { periodKey: targetPeriodKey })
			.groupBy('umc.chest_id')
			.getRawMany<{
				chestId: string | number;
				participantsCount: string;
				claimedCount: string;
				coinsDistributed: string;
			}>();

		const statsByChestId = new Map<
			number,
			{ participants: number; claimed: number; coins: number }
		>();

		for (const row of claimsRaw) {
			statsByChestId.set(Number(row.chestId), {
				participants: Number.parseInt(row.participantsCount ?? '0', 10),
				claimed: Number.parseInt(row.claimedCount ?? '0', 10),
				coins: Number.parseInt(row.coinsDistributed ?? '0', 10),
			});
		}

		const chests: ChestSummaryItem[] = allChests.map(ch => {
			const stats = statsByChestId.get(ch.id) ?? {
				participants: 0,
				claimed: 0,
				coins: 0,
			};
			const claimRate =
				stats.participants > 0
					? Math.round((stats.claimed / stats.participants) * 10_000) / 100
					: 0;

			return {
				chestId: ch.id,
				chestTitle: ch.title,
				requiredMissions: ch.requiredMissions,
				coinsAmount: ch.coinsAmount,
				periodType: ch.periodType,
				participantsCount: stats.participants,
				claimedCount: stats.claimed,
				claimRate,
				totalCoinsDistributed: stats.coins,
			};
		});

		return {
			periodKey: targetPeriodKey,
			chests,
		};
	}

	async getLeaderboard(
		limit: number,
		dateRange?: { startDate: Date; endDate: Date },
	): Promise<LeaderboardEntry[]> {
		const params: (number | Date)[] = [limit];
		let dateCondition = '';
		// TODO: add tight date range filtering for leaderboard queries. If we allow dateRange without an extreme then we might be fetching a lot of data. For now, we will only allow dateRange if both startDate and endDate are provided.
		if (dateRange?.startDate && dateRange?.endDate) {
			params.push(dateRange.startDate, dateRange.endDate);
			dateCondition = 'AND claimed_at >= $2 AND claimed_at <= $3';
		} else if (dateRange?.startDate) {
			params.push(dateRange.startDate);
			dateCondition = 'AND claimed_at >= $2';
		} else if (dateRange?.endDate) {
			params.push(dateRange.endDate);
			dateCondition = 'AND claimed_at <= $2';
		}

		const query = `
			WITH all_rewards AS (
				SELECT player_id, coins_amount, 'mission' AS source
				FROM mission_rewards
				WHERE status = 'CLAIMED'
				  ${dateCondition}
				UNION ALL
				SELECT player_id, coins_amount, 'level' AS source
				FROM level_rewards
				WHERE status = 'CLAIMED'
				  ${dateCondition}
				UNION ALL
				SELECT player_id, coins_amount, 'chest' AS source
				FROM user_mission_chests
				WHERE status = 'CLAIMED'
				  ${dateCondition}
			)
			SELECT
				r.player_id AS "playerId",
				p.username AS "username",
				COALESCE(SUM(r.coins_amount), 0)::int AS "totalCoins",
				COALESCE(SUM(CASE WHEN r.source = 'mission' THEN r.coins_amount ELSE 0 END), 0)::int AS "missionsCoins",
				COALESCE(SUM(CASE WHEN r.source = 'level' THEN r.coins_amount ELSE 0 END), 0)::int AS "levelsCoins",
				COALESCE(SUM(CASE WHEN r.source = 'chest' THEN r.coins_amount ELSE 0 END), 0)::int AS "chestsCoins"
			FROM all_rewards r
			JOIN players p ON p.id = r.player_id
			GROUP BY r.player_id, p.username
			ORDER BY "totalCoins" DESC
			LIMIT $1
		`;

		const rows = (await this.playerRepo.query(query, params)) as RawLeaderboardRow[];

		return rows.map((row, index: number) => ({
			rank: index + 1,
			playerId: Number(row.playerId),
			username: row.username,
			totalCoins: Number(row.totalCoins),
			missionsCoins: Number(row.missionsCoins),
			levelsCoins: Number(row.levelsCoins),
			chestsCoins: Number(row.chestsCoins),
		}));
	}
}
