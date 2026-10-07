import { Test, TestingModule } from '@nestjs/testing';

import { STATISTICS_CORE_PROVIDER, STATISTICS_REPO_PROVIDER } from '../app/constants';
import { LeaderboardPeriod } from '../app/dto/statistics-leaderboard.schema';
import { StatisticsCore } from '../app/statisticsCore';
import type { ForManageStatistics } from '../ports/driven/forManageStatistics';
import type { ForDatabaseStatistics } from '../ports/driver/forDatabaseStatistics';

describe('StatisticsCore', () => {
	let core: ForManageStatistics;
	let mockRepo: jest.Mocked<ForDatabaseStatistics>;

	beforeEach(async () => {
		mockRepo = {
			getCoinsSummary: jest.fn(),
			getEventsCount: jest.fn(),
			getLiabilities: jest.fn(),
			getOperationalRisk: jest.fn(),
			getReviewersSla: jest.fn(),
			getMissionsEngagement: jest.fn(),
			getLevelsDistribution: jest.fn(),
			getChestsSummary: jest.fn(),
			getLeaderboard: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				{
					provide: STATISTICS_REPO_PROVIDER,
					useValue: mockRepo,
				},
				{
					provide: STATISTICS_CORE_PROVIDER,
					useFactory: (repo: ForDatabaseStatistics) => new StatisticsCore(repo),
					inject: [STATISTICS_REPO_PROVIDER],
				},
			],
		}).compile();

		core = module.get<ForManageStatistics>(STATISTICS_CORE_PROVIDER);
	});

	describe('getSummary', () => {
		it('should consolidate coins breakdown and events count', async () => {
			mockRepo.getCoinsSummary.mockResolvedValue({
				missionsCoins: 1000,
				levelsCoins: 2000,
				chestsCoins: 3000,
				totalCoins: 6000,
			});
			mockRepo.getEventsCount.mockResolvedValue({
				completedMissionsCount: 25,
				levelUpsCount: 10,
				claimedChestsCount: 5,
			});

			const filter = {
				startDate: '2026-03-01T00:00:00.000Z',
				endDate: '2026-03-31T23:59:59.999Z',
			};
			const result = await core.getSummary(filter);

			expect(mockRepo.getCoinsSummary).toHaveBeenCalledWith(filter);
			expect(mockRepo.getEventsCount).toHaveBeenCalledWith(filter);
			expect(result).toEqual({
				coinsBreakdown: {
					missionsCoins: 1000,
					levelsCoins: 2000,
					chestsCoins: 3000,
					totalCoins: 6000,
				},
				eventsCount: {
					completedMissionsCount: 25,
					levelUpsCount: 10,
					claimedChestsCount: 5,
				},
			});
		});
	});

	describe('getLiabilities', () => {
		it('should calculate claim rate accurately when claims exist', async () => {
			mockRepo.getLiabilities.mockResolvedValue({
				missionsPendingCoins: 200,
				levelsPendingCoins: 300,
				chestsPendingCoins: 500,
				pendingCoins: 1000,
				claimedCoins: 9000,
				pendingClaimsCount: 15,
			});

			const result = await core.getLiabilities();

			expect(result.pendingCoins).toBe(1000);
			expect(result.claimedCoins).toBe(9000);
			expect(result.claimRate).toBe(90); // 9000 / 10000 = 90%
			expect(result.pendingClaimsCount).toBe(15);
			expect(result.breakdown).toEqual({
				missionsPendingCoins: 200,
				levelsPendingCoins: 300,
				chestsPendingCoins: 500,
			});
		});

		it('should return 0 claimRate when totalCoins is 0', async () => {
			mockRepo.getLiabilities.mockResolvedValue({
				missionsPendingCoins: 0,
				levelsPendingCoins: 0,
				chestsPendingCoins: 0,
				pendingCoins: 0,
				claimedCoins: 0,
				pendingClaimsCount: 0,
			});

			const result = await core.getLiabilities();
			expect(result.claimRate).toBe(0);
		});
	});

	describe('getOperationalRisk', () => {
		it('should delegate operational risk query to repository', async () => {
			const expectedRisk = {
				uncertainClaimsCount: 3,
				uncertainCoinsAmount: 1500,
				breakdown: {
					missions: { count: 1, coinsAmount: 500 },
					levels: { count: 1, coinsAmount: 500 },
					chests: { count: 1, coinsAmount: 500 },
				},
			};
			mockRepo.getOperationalRisk.mockResolvedValue(expectedRisk);

			const result = await core.getOperationalRisk();
			expect(result).toEqual(expectedRisk);
		});
	});

	describe('getReviewersSla', () => {
		it('should delegate reviewers SLA query to repository', async () => {
			const expectedSla = {
				globalAverageReviewTimeMinutes: 12.5,
				totalReviewedStepsCount: 40,
				reviewers: [
					{
						adminId: 1,
						adminUsername: 'admin_test',
						reviewedStepsCount: 40,
						approvedStepsCount: 35,
						rejectedStepsCount: 5,
						averageReviewTimeMinutes: 12.5,
					},
				],
			};
			mockRepo.getReviewersSla.mockResolvedValue(expectedSla);

			const result = await core.getReviewersSla();
			expect(result).toEqual(expectedSla);
		});
	});

	describe('getMissionsEngagement', () => {
		it('should delegate missions engagement query to repository', async () => {
			const expectedEngagement = {
				completionRate: 80.5,
				completedCount: 161,
				inProgressCount: 30,
				cancelledOrExpiredCount: 9,
				averageCompletionMinutes: 45.2,
			};
			mockRepo.getMissionsEngagement.mockResolvedValue(expectedEngagement);

			const result = await core.getMissionsEngagement();
			expect(result).toEqual(expectedEngagement);
		});
	});

	describe('getLevelsDistribution', () => {
		it('should delegate levels distribution query to repository', async () => {
			const expectedDist = {
				totalActivePlayers: 100,
				distribution: [
					{
						levelId: 1,
						levelName: 'Bronce',
						minExperience: 0,
						playersCount: 60,
						percentage: 60,
					},
					{
						levelId: 2,
						levelName: 'Plata',
						minExperience: 1000,
						playersCount: 40,
						percentage: 40,
					},
				],
			};
			mockRepo.getLevelsDistribution.mockResolvedValue(expectedDist);

			const result = await core.getLevelsDistribution();
			expect(result).toEqual(expectedDist);
		});
	});

	describe('getChestsSummary', () => {
		it('should delegate chests summary query with periodKey filter', async () => {
			const expectedSummary = {
				periodKey: '2026-W10',
				chests: [
					{
						chestId: 1,
						chestTitle: 'Cofre Semanal Bronce',
						requiredMissions: 5,
						coinsAmount: 500,
						periodType: 'WEEKLY',
						participantsCount: 20,
						claimedCount: 15,
						claimRate: 75,
						totalCoinsDistributed: 7500,
					},
				],
			};
			mockRepo.getChestsSummary.mockResolvedValue(expectedSummary);

			const result = await core.getChestsSummary({ periodKey: '2026-W10' });
			expect(mockRepo.getChestsSummary).toHaveBeenCalledWith('2026-W10');
			expect(result).toEqual(expectedSummary);
		});
	});

	describe('getLeaderboard', () => {
		it('should query leaderboard for ALL_TIME period without date bounds', async () => {
			const mockEntries = [
				{
					rank: 1,
					playerId: 10,
					username: 'player_one',
					totalCoins: 15_000,
					missionsCoins: 5000,
					levelsCoins: 5000,
					chestsCoins: 5000,
				},
			];
			mockRepo.getLeaderboard.mockResolvedValue(mockEntries);

			const result = await core.getLeaderboard({
				period: LeaderboardPeriod.ALL_TIME,
				limit: 10,
			});

			expect(mockRepo.getLeaderboard).toHaveBeenCalledWith(10, undefined);
			expect(result).toEqual({
				period: LeaderboardPeriod.ALL_TIME,
				startDate: null,
				endDate: null,
				leaderboard: mockEntries,
			});
		});

		it('should compute ISO bounds for WEEKLY period', async () => {
			mockRepo.getLeaderboard.mockResolvedValue([]);

			const result = await core.getLeaderboard({
				period: LeaderboardPeriod.WEEKLY,
				limit: 20,
			});

			expect(mockRepo.getLeaderboard).toHaveBeenCalledWith(
				20,
				expect.objectContaining({
					startDate: expect.any(Date),
					endDate: expect.any(Date),
				}),
			);
			expect(result.period).toBe(LeaderboardPeriod.WEEKLY);
			expect(result.startDate).toBeDefined();
			expect(result.endDate).toBeDefined();
		});
	});
});
