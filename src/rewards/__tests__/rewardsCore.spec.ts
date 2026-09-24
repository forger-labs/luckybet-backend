import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import type { ForPanelApiCore } from '../../panelApi/ports/forPanelApiCore.port';
import { RewardStatus } from '../app/enums';
import { RewardsCore } from '../app/rewardsCore';
import type { ForDatabaseMissionRewards } from '../ports/driver/ForDatabaseMissionRewards';

describe('RewardsCore', () => {
	let rewardsCore: RewardsCore;
	let mockRewardRepo: jest.Mocked<ForDatabaseMissionRewards>;
	let mockPanelApi: jest.Mocked<ForPanelApiCore>;

	const mockReward = {
		id: 1,
		userMissionId: 10,
		playerId: 5,
		coinsAmount: 500,
		experiencePoints: 100,
		status: RewardStatus.PENDING,
	};

	beforeEach(() => {
		mockRewardRepo = {
			createReward: jest.fn(),
			findByUserMissionId: jest.fn(),
			findById: jest.fn(),
			findPendingByPlayer: jest.fn(),
			findUncertainRewards: jest.fn(),
			acquireProcessingLock: jest.fn(),
			updateStatus: jest.fn(),
		};

		mockPanelApi = {
			authenticatePlayer: jest.fn(),
			syncOrRegisterPlayer: jest.fn(),
			invalidatePlayerSession: jest.fn(),
			creditPlayer: jest.fn(),
			debitPlayer: jest.fn(),
			getLastPlayedGame: jest.fn(),
			getLastPlayedGames: jest.fn(),
			hashToken: jest.fn(),
		} as unknown as jest.Mocked<ForPanelApiCore>;

		rewardsCore = new RewardsCore(mockRewardRepo, mockPanelApi);
	});

	describe('claimReward', () => {
		it('debería lanzar NotFoundException si no existe el registro de recompensa', async () => {
			mockRewardRepo.findByUserMissionId.mockResolvedValue(null);

			await expect(rewardsCore.claimReward(10, 5)).rejects.toThrow(NotFoundException);
		});

		it('debería lanzar ForbiddenException si el jugador no es el dueño', async () => {
			mockRewardRepo.findByUserMissionId.mockResolvedValue(mockReward);

			await expect(rewardsCore.claimReward(10, 99)).rejects.toThrow(ForbiddenException);
		});

		it('debería lanzar BadRequestException si ya fue reclamado', async () => {
			mockRewardRepo.findByUserMissionId.mockResolvedValue({
				...mockReward,
				status: RewardStatus.CLAIMED,
			});

			await expect(rewardsCore.claimReward(10, 5)).rejects.toThrow(BadRequestException);
		});

		it('debería lanzar ConflictException si no puede adquirir el bloqueo atómico (concurrencia)', async () => {
			mockRewardRepo.findByUserMissionId.mockResolvedValue(mockReward);
			mockRewardRepo.acquireProcessingLock.mockResolvedValue(null);

			await expect(rewardsCore.claimReward(10, 5)).rejects.toThrow(ConflictException);
		});

		it('debería acreditar exitosamente las fichas y marcar status CLAIMED', async () => {
			mockRewardRepo.findByUserMissionId.mockResolvedValue(mockReward);
			mockRewardRepo.acquireProcessingLock.mockResolvedValue({
				...mockReward,
				status: RewardStatus.PROCESSING,
			});
			mockPanelApi.creditPlayer.mockResolvedValue({
				success: true,
				operationId: '849201',
			});
			mockRewardRepo.updateStatus.mockResolvedValue({
				...mockReward,
				status: RewardStatus.CLAIMED,
				externalOperationId: '849201',
			});

			const result = await rewardsCore.claimReward(10, 5);

			expect(mockPanelApi.creditPlayer).toHaveBeenCalledWith(5, 500);
			expect(mockRewardRepo.updateStatus).toHaveBeenCalledWith(1, RewardStatus.CLAIMED, {
				externalOperationId: '849201',
				claimedAt: expect.any(Date),
			});
			expect(result.status).toBe(RewardStatus.CLAIMED);
		});

		it('debería marcar TIMEOUT_UNCERTAIN si la llamada a LuckyBet lanza error de red', async () => {
			mockRewardRepo.findByUserMissionId.mockResolvedValue(mockReward);
			mockRewardRepo.acquireProcessingLock.mockResolvedValue({
				...mockReward,
				status: RewardStatus.PROCESSING,
			});
			mockPanelApi.creditPlayer.mockRejectedValue(new Error('ETIMEDOUT'));
			mockRewardRepo.updateStatus.mockResolvedValue({
				...mockReward,
				status: RewardStatus.TIMEOUT_UNCERTAIN,
				errorMessage: 'ETIMEDOUT',
			});

			const result = await rewardsCore.claimReward(10, 5);

			expect(mockRewardRepo.updateStatus).toHaveBeenCalledWith(1, RewardStatus.TIMEOUT_UNCERTAIN, {
				errorMessage: 'ETIMEDOUT',
			});
			expect(result.status).toBe(RewardStatus.TIMEOUT_UNCERTAIN);
		});
	});

	describe('resolveUncertainReward', () => {
		const uncertainReward = {
			...mockReward,
			status: RewardStatus.TIMEOUT_UNCERTAIN,
		};

		it('debería resolver como CLAIMED con RESOLVE_CLAIMED guardando resolvedByAdminId', async () => {
			mockRewardRepo.findById.mockResolvedValue(uncertainReward);
			mockRewardRepo.updateStatus.mockResolvedValue({
				...uncertainReward,
				status: RewardStatus.CLAIMED,
				externalOperationId: '9999',
				resolvedByAdminId: 2,
			});

			const result = await rewardsCore.resolveUncertainReward(1, 'RESOLVE_CLAIMED', 2, {
				externalOperationId: '9999',
				adminNotes: 'Verificado manualmente',
			});

			expect(mockPanelApi.creditPlayer).not.toHaveBeenCalled();
			expect(mockRewardRepo.updateStatus).toHaveBeenCalledWith(1, RewardStatus.CLAIMED, {
				externalOperationId: '9999',
				errorMessage: 'Resuelto: Verificado manualmente',
				resolvedByAdminId: 2,
				claimedAt: expect.any(Date),
			});
			expect(result.status).toBe(RewardStatus.CLAIMED);
		});

		it('debería ejecutar creditPlayer con FORCE_RETRY guardando resolvedByAdminId', async () => {
			mockRewardRepo.findById.mockResolvedValue(uncertainReward);
			mockPanelApi.creditPlayer.mockResolvedValue({
				success: true,
				operationId: '12345',
			});
			mockRewardRepo.updateStatus.mockResolvedValue({
				...uncertainReward,
				status: RewardStatus.CLAIMED,
				externalOperationId: '12345',
				resolvedByAdminId: 2,
			});

			const result = await rewardsCore.resolveUncertainReward(1, 'FORCE_RETRY', 2);

			expect(mockPanelApi.creditPlayer).toHaveBeenCalledWith(5, 500);
			expect(mockRewardRepo.updateStatus).toHaveBeenCalledWith(1, RewardStatus.CLAIMED, {
				externalOperationId: '12345',
				resolvedByAdminId: 2,
				claimedAt: expect.any(Date),
			});
			expect(result.status).toBe(RewardStatus.CLAIMED);
		});
	});
});
