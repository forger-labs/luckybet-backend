import { BadRequestException, ConflictException } from '@nestjs/common';

import { ChestPeriodType } from '../../chests/app/enums';
import type { ForManageChests } from '../../chests/ports/driven/ForManageChests';
import type { ForDatabaseUserMissions } from '../../misiones/ports/driver/ForDatabaseUserMissions';
import type { ForPanelApiCore } from '../../panelApi/ports/forPanelApiCore.port';
import type { ForDatabasePlayers } from '../../players/ports/driver/ForDatabasePlayers';
import { RewardStatus } from '../../rewards/app/enums';
import type { ForDatabaseRooms } from '../../rooms/ports/driver/ForDatabaseRooms';
import { BonusIntern } from '../../types/bonus';
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
	let mockRoomRepo: jest.Mocked<ForDatabaseRooms>;

	const mockBaseRoom = {
		id: 1,
		name: 'Superala',
		bonus: BonusIntern.Zero,
		isActive: true,
	};

	const mockPromoRoom = {
		id: 3,
		name: 'SalaDel200%',
		bonus: BonusIntern.TwoHundred,
		isActive: true,
	};

	const mockChest = {
		id: 1,
		title: 'Cofre Semanal',
		periodType: ChestPeriodType.WEEKLY,
		requiredMissions: 5,
		coinsAmount: 500,
		roomId: 3,
		experiencePoints: 100,
		isActive: true,
	};

	beforeEach(() => {
		mockClaimRepo = {
			findByPlayerAndPeriod: jest.fn(),
			findById: jest.fn(),
			acquireClaimLock: jest.fn(),
			updateStatus: jest.fn(),
			getPlayerChests: jest.fn(),
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
		};

		mockUserMissionRepo = {
			createUserMission: jest.fn(),
			findById: jest.fn(),
			findByPlayerAndMission: jest.fn(),
			updateStatus: jest.fn(),
			countCompletedBetween: jest.fn(),
			findUserMissionsWithContext: jest.fn(),
			findByIdWithSteps: jest.fn(),
			findByPlayer: jest.fn(),
			updateCurrentStep: jest.fn(),
		};

		mockPanelApi = {
			authenticatePlayer: jest.fn(),
			syncOrRegisterPlayer: jest.fn(),
			getLastPlayedGames: jest.fn(),
			getLastPlayedGame: jest.fn(),
			debitPlayer: jest.fn(),
			hashToken: jest.fn(),
			invalidatePlayerSession: jest.fn(),
			creditPlayer: jest.fn(),
			changePlayerSenior: jest.fn(),
		};

		mockPlayerRepo = {
			createPlayer: jest.fn(),
			updatePlayerById: jest.fn(),
			getPlayers: jest.fn(),
			findByUnique: jest.fn(),
			addExperienceAndRecalculateLevel: jest.fn(),
		};

		mockRoomRepo = {
			createRoom: jest.fn(),
			findById: jest.fn(),
			findByName: jest.fn(),
			updateRoom: jest.fn(),
			getRooms: jest.fn(),
			findActiveRooms: jest.fn(),
		};

		core = new PlayerChestsCore(
			mockClaimRepo,
			mockChestsCore,
			mockUserMissionRepo,
			mockPanelApi,
			mockPlayerRepo,
			mockRoomRepo,
		);
	});

	it('debe obtener el progreso de un cofre por su ID', async () => {
		mockChestsCore.getChest.mockResolvedValue(mockChest as never);
		mockUserMissionRepo.countCompletedBetween.mockResolvedValue(3);
		mockClaimRepo.findByPlayerAndPeriod.mockResolvedValue(null);

		const result = await core.getChestProgressById(1, 10);

		expect(result.chest.id).toBe(1);
		expect(result.completedMissions).toBe(3);
		expect(result.requiredMissions).toBe(5);
		expect(result.state).toBe(ChestProgressState.LOCKED);
	});

	it('debe registrar la participación de un usuario en un cofre (joinChest)', async () => {
		mockChestsCore.getChest.mockResolvedValue(mockChest as never);
		mockClaimRepo.findByPlayerAndPeriod.mockResolvedValue(null);
		mockUserMissionRepo.countCompletedBetween.mockResolvedValue(2);
		mockClaimRepo.acquireClaimLock.mockResolvedValue({
			id: 55,
			playerId: 10,
			chestId: 1,
			periodKey: '2026-W39',
			completedMissionsCount: 2,
			coinsAmount: 500,
			status: RewardStatus.PENDING,
		});

		const result = await core.joinChest(1, 10);
		expect(result.id).toBe(55);
		expect(result.status).toBe(RewardStatus.PENDING);
	});

	it('debe listar los cofres del jugador con filtros y paginación', async () => {
		mockClaimRepo.getPlayerChests.mockResolvedValue([
			[
				{
					id: 1,
					playerId: 10,
					chestId: 1,
					periodKey: '2026-W39',
					completedMissionsCount: 5,
					coinsAmount: 500,
					status: RewardStatus.CLAIMED,
				},
			],
			1,
		]);

		const result = await core.listPlayerChests(10, { take: 10, skip: 0 });
		expect(result.claims).toHaveLength(1);
		expect(result.total).toBe(1);
	});

	it('debe lanzar BadRequestException si el jugador no ha alcanzado la meta requerida', async () => {
		mockChestsCore.getChest.mockResolvedValue(mockChest as never);
		mockUserMissionRepo.countCompletedBetween.mockResolvedValue(2);

		await expect(core.claimChest(1, 10)).rejects.toThrow(BadRequestException);
	});

	it('debe ejecutar el reclamo completo con transferencia a sala del cofre y retorno a sala base', async () => {
		mockChestsCore.getChest.mockResolvedValue(mockChest as never);
		mockUserMissionRepo.countCompletedBetween.mockResolvedValue(5);
		mockClaimRepo.findByPlayerAndPeriod.mockResolvedValue(null);
		mockClaimRepo.acquireClaimLock.mockResolvedValue({
			id: 100,
			playerId: 10,
			chestId: 1,
			periodKey: '2026-W39',
			completedMissionsCount: 5,
			coinsAmount: 500,
			roomId: 3,
			status: RewardStatus.PROCESSING,
		});

		mockPlayerRepo.findByUnique.mockResolvedValue({
			id: 10,
			username: 'player_test',
			experience: 0,
			isActive: true,
			phone: null,
			room: mockBaseRoom,
		});

		mockRoomRepo.findById.mockResolvedValue(mockPromoRoom as never);
		mockPanelApi.changePlayerSenior.mockResolvedValue(true);
		mockPanelApi.creditPlayer.mockResolvedValue({
			success: true,
			operationId: 'op_chest_123',
		});
		mockClaimRepo.updateStatus.mockResolvedValue({
			id: 100,
			playerId: 10,
			chestId: 1,
			periodKey: '2026-W39',
			completedMissionsCount: 5,
			coinsAmount: 500,
			roomId: 3,
			status: RewardStatus.CLAIMED,
			externalOperationId: 'op_chest_123',
		});

		const result = await core.claimChest(1, 10);

		expect(mockPlayerRepo.addExperienceAndRecalculateLevel).toHaveBeenCalledWith(10, 100);
		expect(mockPanelApi.changePlayerSenior).toHaveBeenNthCalledWith(
			1,
			'player_test',
			'SalaDel200%',
		);
		expect(mockPanelApi.creditPlayer).toHaveBeenCalledWith('player_test', 500);
		expect(mockPanelApi.changePlayerSenior).toHaveBeenNthCalledWith(
			2,
			'player_test',
			'Superala',
		);
		expect(result.status).toBe(RewardStatus.CLAIMED);
	});

	it('debe marcar TIMEOUT_UNCERTAIN si falla la transferencia a la sala del cofre', async () => {
		mockChestsCore.getChest.mockResolvedValue(mockChest as never);
		mockUserMissionRepo.countCompletedBetween.mockResolvedValue(5);
		mockClaimRepo.findByPlayerAndPeriod.mockResolvedValue(null);
		mockClaimRepo.acquireClaimLock.mockResolvedValue({
			id: 101,
			playerId: 10,
			chestId: 1,
			periodKey: '2026-W39',
			completedMissionsCount: 5,
			coinsAmount: 500,
			roomId: 3,
			status: RewardStatus.PROCESSING,
		});

		mockPlayerRepo.findByUnique.mockResolvedValue({
			id: 10,
			username: 'player_test',
			experience: 0,
			isActive: true,
			phone: null,
			room: mockBaseRoom,
		});

		mockRoomRepo.findById.mockResolvedValue(mockPromoRoom as never);
		mockPanelApi.changePlayerSenior.mockResolvedValue(false);

		mockClaimRepo.updateStatus.mockResolvedValue({
			id: 101,
			playerId: 10,
			chestId: 1,
			periodKey: '2026-W39',
			completedMissionsCount: 5,
			coinsAmount: 500,
			roomId: 3,
			status: RewardStatus.TIMEOUT_UNCERTAIN,
		});

		const result = await core.claimChest(1, 10);

		expect(mockPanelApi.creditPlayer).not.toHaveBeenCalled();
		expect(result.status).toBe(RewardStatus.TIMEOUT_UNCERTAIN);
	});
});
