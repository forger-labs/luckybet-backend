import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { ChestPeriodType } from '../../chests/app/enums';
import type { ForManageChests } from '../../chests/ports/driven/ForManageChests';
import type { ForDatabaseUserMissions } from '../../misiones/ports/driver/ForDatabaseUserMissions';
import type { ForPanelApiCore } from '../../panelApi/ports/forPanelApiCore.port';
import type { ForDatabasePlayers } from '../../players/ports/driver/ForDatabasePlayers';
import { RewardStatus } from '../../rewards/app/enums';
import { ChestProgressState } from '../app/dto/player-chest.schema';
import { PlayerChestsCore } from '../app/playerChestsCore';
import type { ForDatabasePlayerChests } from '../ports/driver/ForDatabasePlayerChests';

describe('PlayerChestsCore', () => {
	let core: PlayerChestsCore;
	let mockClaimRepo: jest.Mocked<ForDatabasePlayerChests>;
	let mockChestsCore: jest.Mocked<ForManageChests>;
	let mockUserMissionRepo: jest.Mocked<ForDatabaseUserMissions>;
	let mockPanelApi: jest.Mocked<ForPanelApiCore>;
	let mockPlayerRepo: jest.Mocked<ForDatabasePlayers>;

	const mockChest = {
		id: 1,
		title: 'Cofre Semanal',
		periodType: ChestPeriodType.WEEKLY,
		requiredMissions: 5,
		coinsAmount: 500,
		experiencePoints: 100,
		isActive: true,
	};

	beforeEach(() => {
		mockClaimRepo = {
			findByPlayerAndPeriod: jest.fn(),
			findById: jest.fn(),
			acquireClaimLock: jest.fn(),
			updateStatus: jest.fn(),
			findUncertainClaims: jest.fn(),
		};

		mockChestsCore = {
			createChest: jest.fn(),
			getChest: jest.fn(),
			updateChest: jest.fn(),
			replaceChestImage: jest.fn(),
			deleteChestImage: jest.fn(),
			toggleChestActive: jest.fn(),
			listChests: jest.fn(),
			getActiveChests: jest.fn(),
		};

		mockUserMissionRepo = {
			createUserMission: jest.fn(),
			findById: jest.fn(),
			findByPlayerAndMission: jest.fn(),
			findByPlayer: jest.fn(),
			findByIdWithSteps: jest.fn(),
			findUserMissionsWithContext: jest.fn(),
			updateCurrentStep: jest.fn(),
			updateStatus: jest.fn(),
			countCompletedBetween: jest.fn(),
		};

		mockPanelApi = {
			creditPlayer: jest.fn(),
		} as unknown as jest.Mocked<ForPanelApiCore>;

		mockPlayerRepo = {
			createPlayer: jest.fn(),
			updatePlayerById: jest.fn(),
			getPlayers: jest.fn(),
			findByUnique: jest.fn(),
		};

		core = new PlayerChestsCore(
			mockClaimRepo,
			mockChestsCore,
			mockUserMissionRepo,
			mockPanelApi,
			mockPlayerRepo,
		);
	});

	describe('getPlayerChestsProgress', () => {
		it('debería retornar estado LOCKED si el jugador no ha alcanzado las misiones requeridas', async () => {
			mockChestsCore.getActiveChests.mockResolvedValue([mockChest]);
			mockUserMissionRepo.countCompletedBetween.mockResolvedValue(3);
			mockClaimRepo.findByPlayerAndPeriod.mockResolvedValue(null);

			const result = await core.getPlayerChestsProgress(10);

			expect(result).toHaveLength(1);
			expect(result[0].completedMissions).toBe(3);
			expect(result[0].requiredMissions).toBe(5);
			expect(result[0].state).toBe(ChestProgressState.LOCKED);
		});

		it('debería retornar estado UNLOCKED si el jugador alcanzó las misiones requeridas', async () => {
			mockChestsCore.getActiveChests.mockResolvedValue([mockChest]);
			mockUserMissionRepo.countCompletedBetween.mockResolvedValue(5);
			mockClaimRepo.findByPlayerAndPeriod.mockResolvedValue(null);

			const result = await core.getPlayerChestsProgress(10);

			expect(result[0].state).toBe(ChestProgressState.UNLOCKED);
		});

		it('debería retornar estado CLAIMED si ya fue cobrado en el periodo actual', async () => {
			mockChestsCore.getActiveChests.mockResolvedValue([mockChest]);
			mockUserMissionRepo.countCompletedBetween.mockResolvedValue(5);
			mockClaimRepo.findByPlayerAndPeriod.mockResolvedValue({
				id: 1,
				playerId: 10,
				chestId: 1,
				periodKey: '2026-W39',
				completedMissionsCount: 5,
				status: RewardStatus.CLAIMED,
				claimedAt: new Date(),
			});

			const result = await core.getPlayerChestsProgress(10);

			expect(result[0].state).toBe(ChestProgressState.CLAIMED);
		});
	});

	describe('claimChest', () => {
		it('debería lanzar BadRequestException si el jugador no cumple la meta', async () => {
			mockChestsCore.getChest.mockResolvedValue(mockChest);
			mockUserMissionRepo.countCompletedBetween.mockResolvedValue(3);

			await expect(core.claimChest(1, 10)).rejects.toThrow(BadRequestException);
		});

		it('debería lanzar ConflictException / BadRequestException si ya fue reclamado', async () => {
			mockChestsCore.getChest.mockResolvedValue(mockChest);
			mockUserMissionRepo.countCompletedBetween.mockResolvedValue(5);
			mockClaimRepo.acquireClaimLock.mockResolvedValue(null);
			mockClaimRepo.findByPlayerAndPeriod.mockResolvedValue({
				id: 1,
				playerId: 10,
				chestId: 1,
				periodKey: '2026-W39',
				completedMissionsCount: 5,
				status: RewardStatus.CLAIMED,
			});

			await expect(core.claimChest(1, 10)).rejects.toThrow(BadRequestException);
		});

		it('debería acreditar exitosamente las fichas del cofre y marcar CLAIMED', async () => {
			mockChestsCore.getChest.mockResolvedValue(mockChest);
			mockUserMissionRepo.countCompletedBetween.mockResolvedValue(5);
			mockClaimRepo.acquireClaimLock.mockResolvedValue({
				id: 1,
				playerId: 10,
				chestId: 1,
				periodKey: '2026-W39',
				completedMissionsCount: 5,
				status: RewardStatus.PROCESSING,
			});
			mockPlayerRepo.findByUnique.mockResolvedValue({
				id: 10,
				username: 'test',
				experience: 100,
				isActive: true,
			});
			mockPanelApi.creditPlayer.mockResolvedValue({
				success: true,
				operationId: 'chest_op_123',
			});
			mockClaimRepo.updateStatus.mockResolvedValue({
				id: 1,
				playerId: 10,
				chestId: 1,
				periodKey: '2026-W39',
				completedMissionsCount: 5,
				status: RewardStatus.CLAIMED,
				externalOperationId: 'chest_op_123',
			});

			const result = await core.claimChest(1, 10);

			expect(mockPlayerRepo.updatePlayerById).toHaveBeenCalledWith(10, { experience: 200 });
			expect(mockPanelApi.creditPlayer).toHaveBeenCalledWith(10, 500);
			expect(result.status).toBe(RewardStatus.CLAIMED);
		});
	});

	describe('resolveUncertainClaim', () => {
		const uncertainClaim = {
			id: 1,
			playerId: 10,
			chestId: 1,
			periodKey: '2026-W39',
			completedMissionsCount: 5,
			status: RewardStatus.TIMEOUT_UNCERTAIN,
		};

		it('debería resolver como CLAIMED con RESOLVE_CLAIMED registrando resolvedByAdminId sin alterar experiencia', async () => {
			mockClaimRepo.findById.mockResolvedValue(uncertainClaim);
			mockChestsCore.getChest.mockResolvedValue(mockChest);
			mockClaimRepo.updateStatus.mockResolvedValue({
				...uncertainClaim,
				status: RewardStatus.CLAIMED,
				externalOperationId: 'op_ext_999',
				resolvedByAdminId: 2,
			});

			const result = await core.resolveUncertainClaim(1, 'RESOLVE_CLAIMED', 2, {
				externalOperationId: 'op_ext_999',
				adminNotes: 'Verificado manualmente en LuckyBet',
			});

			expect(mockPanelApi.creditPlayer).not.toHaveBeenCalled();
			expect(mockPlayerRepo.updatePlayerById).not.toHaveBeenCalled();
			expect(mockClaimRepo.updateStatus).toHaveBeenCalledWith(1, RewardStatus.CLAIMED, {
				externalOperationId: 'op_ext_999',
				errorMessage: 'Resuelto: Verificado manualmente en LuckyBet',
				resolvedByAdminId: 2,
				claimedAt: expect.any(Date),
			});
			expect(result.status).toBe(RewardStatus.CLAIMED);
		});

		it('debería forzar la llamada a creditPlayer con FORCE_RETRY registrando resolvedByAdminId sin alterar experiencia', async () => {
			mockClaimRepo.findById.mockResolvedValue(uncertainClaim);
			mockChestsCore.getChest.mockResolvedValue(mockChest);
			mockPanelApi.creditPlayer.mockResolvedValue({
				success: true,
				operationId: 'op_retry_888',
			});
			mockClaimRepo.updateStatus.mockResolvedValue({
				...uncertainClaim,
				status: RewardStatus.CLAIMED,
				externalOperationId: 'op_retry_888',
				resolvedByAdminId: 2,
			});

			const result = await core.resolveUncertainClaim(1, 'FORCE_RETRY', 2);

			expect(mockPanelApi.creditPlayer).toHaveBeenCalledWith(10, 500);
			expect(mockPlayerRepo.updatePlayerById).not.toHaveBeenCalled();
			expect(mockClaimRepo.updateStatus).toHaveBeenCalledWith(1, RewardStatus.CLAIMED, {
				externalOperationId: 'op_retry_888',
				resolvedByAdminId: 2,
				claimedAt: expect.any(Date),
			});
			expect(result.status).toBe(RewardStatus.CLAIMED);
		});
	});
});
