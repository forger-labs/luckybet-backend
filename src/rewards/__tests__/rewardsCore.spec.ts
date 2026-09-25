import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	NotFoundException,
} from '@nestjs/common';

import type { ForPanelApiCore } from '../../panelApi/ports/forPanelApiCore.port';
import type { ForDatabasePlayers } from '../../players/ports/driver/ForDatabasePlayers';
import type { ForDatabaseRooms } from '../../rooms/ports/driver/ForDatabaseRooms';
import { BonusIntern } from '../../types/bonus';
import { RewardStatus } from '../app/enums';
import { RewardsCore } from '../app/rewardsCore';
import type { ForDatabaseMissionRewards } from '../ports/driver/ForDatabaseMissionRewards';

describe('RewardsCore', () => {
	let rewardsCore: RewardsCore;
	let mockRewardRepo: jest.Mocked<ForDatabaseMissionRewards>;
	let mockPanelApi: jest.Mocked<ForPanelApiCore>;
	let mockPlayerRepo: jest.Mocked<ForDatabasePlayers>;
	let mockRoomRepo: jest.Mocked<ForDatabaseRooms>;

	const mockBaseRoom = {
		id: 1,
		name: 'Superala',
		bonus: BonusIntern.Zero,
		isActive: true,
	};

	const mockPromoRoom = {
		id: 2,
		name: 'SuperAla200%',
		bonus: BonusIntern.TwoHundred,
		isActive: true,
	};

	const mockReward = {
		id: 1,
		userMissionId: 10,
		playerId: 5,
		coinsAmount: 500,
		roomId: 2,
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
			changePlayerSenior: jest.fn().mockResolvedValue(true),
			getPlayerSenior: jest.fn(),
			hashToken: jest.fn(),
		} as unknown as jest.Mocked<ForPanelApiCore>;

		mockPlayerRepo = {
			findByUnique: jest.fn().mockResolvedValue({
				id: 5,
				username: 'serrot99',
				experience: 100,
				isActive: true,
				roomId: 1,
				room: mockBaseRoom,
			}),
			createPlayer: jest.fn(),
			updatePlayerById: jest.fn(),
			getPlayers: jest.fn(),
			addExperienceAndRecalculateLevel: jest.fn(),
		};

		mockRoomRepo = {
			findById: jest.fn().mockResolvedValue(mockPromoRoom),
			findByName: jest.fn(),
			createRoom: jest.fn(),
			updateRoom: jest.fn(),
			getRooms: jest.fn(),
			findActiveRooms: jest.fn(),
		};

		rewardsCore = new RewardsCore(
			mockRewardRepo,
			mockPanelApi,
			mockPlayerRepo,
			mockRoomRepo,
		);
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

		it('debería transferir a sala promocional, acreditar y retornar obligatoriamente a la sala base', async () => {
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

			// 1. Mover a la sala promocional
			expect(mockPanelApi.changePlayerSenior).toHaveBeenNthCalledWith(
				1,
				'serrot99',
				'SuperAla200%',
			);
			// 2. Acreditar saldo
			expect(mockPanelApi.creditPlayer).toHaveBeenCalledWith('serrot99', 500);
			// 3. Regresar a la sala base
			expect(mockPanelApi.changePlayerSenior).toHaveBeenNthCalledWith(
				2,
				'serrot99',
				'Superala',
			);
			expect(result.status).toBe(RewardStatus.CLAIMED);
		});

		it('debería marcar TIMEOUT_UNCERTAIN si falla la transferencia previa a la sala promocional (abortando crédito)', async () => {
			mockRewardRepo.findByUserMissionId.mockResolvedValue(mockReward);
			mockRewardRepo.acquireProcessingLock.mockResolvedValue({
				...mockReward,
				status: RewardStatus.PROCESSING,
			});
			mockPanelApi.changePlayerSenior.mockResolvedValueOnce(false);
			mockRewardRepo.updateStatus.mockResolvedValue({
				...mockReward,
				status: RewardStatus.TIMEOUT_UNCERTAIN,
			});

			const result = await rewardsCore.claimReward(10, 5);

			expect(mockPanelApi.creditPlayer).not.toHaveBeenCalled();
			expect(mockRewardRepo.updateStatus).toHaveBeenCalledWith(
				1,
				RewardStatus.TIMEOUT_UNCERTAIN,
				{
					errorMessage: expect.stringContaining(
						'Fallo al transferir a la sala promocional',
					),
				},
			);
			expect(result.status).toBe(RewardStatus.TIMEOUT_UNCERTAIN);
		});

		it('debería marcar TIMEOUT_UNCERTAIN si el crédito tiene éxito pero falla el retorno a la sala base', async () => {
			mockRewardRepo.findByUserMissionId.mockResolvedValue(mockReward);
			mockRewardRepo.acquireProcessingLock.mockResolvedValue({
				...mockReward,
				status: RewardStatus.PROCESSING,
			});
			// Transferencia inicial exitosa
			mockPanelApi.changePlayerSenior.mockResolvedValueOnce(true);
			// Crédito exitoso
			mockPanelApi.creditPlayer.mockResolvedValue({
				success: true,
				operationId: '849201',
			});
			// Retorno a sala base falla
			mockPanelApi.changePlayerSenior.mockResolvedValueOnce(false);
			mockRewardRepo.updateStatus.mockResolvedValue({
				...mockReward,
				status: RewardStatus.TIMEOUT_UNCERTAIN,
			});

			const result = await rewardsCore.claimReward(10, 5);

			expect(mockRewardRepo.updateStatus).toHaveBeenCalledWith(
				1,
				RewardStatus.TIMEOUT_UNCERTAIN,
				{
					externalOperationId: '849201',
					errorMessage: expect.stringContaining('fallo el retorno a la sala base'),
					claimedAt: expect.any(Date),
				},
			);
			expect(result.status).toBe(RewardStatus.TIMEOUT_UNCERTAIN);
		});
	});

	describe('resolveUncertainReward', () => {
		const uncertainReward = {
			...mockReward,
			status: RewardStatus.TIMEOUT_UNCERTAIN,
		};

		it('debería resolver como CLAIMED con RESOLVE_CLAIMED regresando a sala base y registrando resolvedByAdminId', async () => {
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

			expect(mockPanelApi.changePlayerSenior).toHaveBeenCalledWith(
				'serrot99',
				'Superala',
			);
			expect(mockPanelApi.creditPlayer).not.toHaveBeenCalled();
			expect(mockRewardRepo.updateStatus).toHaveBeenCalledWith(1, RewardStatus.CLAIMED, {
				externalOperationId: '9999',
				errorMessage: 'Resuelto: Verificado manualmente',
				resolvedByAdminId: 2,
				claimedAt: expect.any(Date),
			});
			expect(result.status).toBe(RewardStatus.CLAIMED);
		});
	});
});
