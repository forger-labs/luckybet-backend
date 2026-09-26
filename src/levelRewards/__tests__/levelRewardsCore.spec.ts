import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { ForManageLevels } from '../../levels/ports/drivens/forManageLevels';
import type { ForPanelApiCore } from '../../panelApi/ports/forPanelApiCore.port';
import type { ForDatabasePlayers } from '../../players/ports/driver/ForDatabasePlayers';
import { RewardStatus } from '../../rewards/app/enums';
import type { ForDatabaseRooms } from '../../rooms/ports/driver/ForDatabaseRooms';
import { BonusIntern } from '../../types/bonus';
import { LevelRewardsCore } from '../app/levelRewardsCore';
import type { ForDatabaseLevelRewards } from '../ports/driver/ForDatabaseLevelRewards';

describe('LevelRewardsCore', () => {
	let core: LevelRewardsCore;
	let mockRewardRepo: jest.Mocked<ForDatabaseLevelRewards>;
	let mockLevelsCore: jest.Mocked<ForManageLevels>;
	let mockPanelApi: jest.Mocked<ForPanelApiCore>;
	let mockPlayerRepo: jest.Mocked<ForDatabasePlayers>;
	let mockRoomRepo: jest.Mocked<ForDatabaseRooms>;

	const mockBaseRoom = {
		id: 1,
		name: 'SalaPrincipal',
		bonus: BonusIntern.Zero,
		isActive: true,
	};

	const mockPromoRoom = {
		id: 5,
		name: 'SalaNivel100%',
		bonus: BonusIntern.OneHundred,
		isActive: true,
	};

	const mockLevel = {
		id: 2,
		name: 'Nivel 2',
		coins: 1000,
		minExperience: 500,
		image: 'level2.png',
		roomId: 5,
	};

	beforeEach(() => {
		mockRewardRepo = {
			createReward: jest.fn(),
			findByPlayerAndLevel: jest.fn(),
			findById: jest.fn(),
			acquireClaimLock: jest.fn(),
			updateStatus: jest.fn(),
			getPlayerRewards: jest.fn(),
		};

		mockLevelsCore = {
			createLevel: jest.fn(),
			getLevelById: jest.fn(),
			getLevels: jest.fn(),
			updateLevel: jest.fn(),
			getLowestLevel: jest.fn(),
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

		core = new LevelRewardsCore(
			mockRewardRepo,
			mockLevelsCore,
			mockPanelApi,
			mockPlayerRepo,
			mockRoomRepo,
		);
	});

	it('debe lanzar NotFoundException si el nivel no existe', async () => {
		mockLevelsCore.getLevelById.mockResolvedValue(null as never);

		await expect(core.claimLevelReward(999, 10)).rejects.toThrow(NotFoundException);
	});

	it('debe lanzar BadRequestException si el jugador no ha alcanzado el nivel', async () => {
		mockLevelsCore.getLevelById.mockResolvedValue(mockLevel as never);
		mockPlayerRepo.findByUnique.mockResolvedValue({
			id: 10,
			username: 'pepito',
			levelId: 1, // jugador tiene nivel 1, intenta reclamar nivel 2
			experience: 100,
			isActive: true,
			phone: null,
			room: mockBaseRoom,
		});

		await expect(core.claimLevelReward(2, 10)).rejects.toThrow(BadRequestException);
	});

	it('debe ejecutar el reclamo seguro de nivel con transferencia a sala de nivel y retorno', async () => {
		mockLevelsCore.getLevelById.mockResolvedValue(mockLevel as never);
		mockPlayerRepo.findByUnique.mockResolvedValue({
			id: 10,
			username: 'pepito',
			levelId: 2,
			experience: 600,
			isActive: true,
			phone: null,
			room: mockBaseRoom,
		});

		mockRewardRepo.findByPlayerAndLevel.mockResolvedValue(null);
		mockRewardRepo.acquireClaimLock.mockResolvedValue({
			id: 1,
			playerId: 10,
			levelId: 2,
			coinsAmount: 1000,
			roomId: 5,
			status: RewardStatus.PROCESSING,
		});

		mockRoomRepo.findById.mockResolvedValue(mockPromoRoom as never);
		mockPanelApi.changePlayerSenior.mockResolvedValue(true);
		mockPanelApi.creditPlayer.mockResolvedValue({
			success: true,
			operationId: 'op_lvl_456',
		});
		mockRewardRepo.updateStatus.mockResolvedValue({
			id: 1,
			playerId: 10,
			levelId: 2,
			coinsAmount: 1000,
			roomId: 5,
			status: RewardStatus.CLAIMED,
			externalOperationId: 'op_lvl_456',
		});

		const result = await core.claimLevelReward(2, 10);

		expect(mockPanelApi.changePlayerSenior).toHaveBeenNthCalledWith(
			1,
			'pepito',
			'SalaNivel100%',
		);
		expect(mockPanelApi.creditPlayer).toHaveBeenCalledWith('pepito', 1000);
		expect(mockPanelApi.changePlayerSenior).toHaveBeenNthCalledWith(
			2,
			'pepito',
			'SalaPrincipal',
		);
		expect(result.status).toBe(RewardStatus.CLAIMED);
	});

	it('debe pasar a TIMEOUT_UNCERTAIN si falla la transferencia a la sala del nivel', async () => {
		mockLevelsCore.getLevelById.mockResolvedValue(mockLevel as never);
		mockPlayerRepo.findByUnique.mockResolvedValue({
			id: 10,
			username: 'pepito',
			levelId: 2,
			experience: 600,
			isActive: true,
			phone: null,
			room: mockBaseRoom,
		});

		mockRewardRepo.findByPlayerAndLevel.mockResolvedValue(null);
		mockRewardRepo.acquireClaimLock.mockResolvedValue({
			id: 2,
			playerId: 10,
			levelId: 2,
			coinsAmount: 1000,
			roomId: 5,
			status: RewardStatus.PROCESSING,
		});

		mockRoomRepo.findById.mockResolvedValue(mockPromoRoom as never);
		mockPanelApi.changePlayerSenior.mockResolvedValue(false); // falla

		mockRewardRepo.updateStatus.mockResolvedValue({
			id: 2,
			playerId: 10,
			levelId: 2,
			coinsAmount: 1000,
			roomId: 5,
			status: RewardStatus.TIMEOUT_UNCERTAIN,
		});

		const result = await core.claimLevelReward(2, 10);

		expect(mockPanelApi.creditPlayer).not.toHaveBeenCalled();
		expect(result.status).toBe(RewardStatus.TIMEOUT_UNCERTAIN);
	});

	it('debe listar recompensas del jugador con filtros y paginación', async () => {
		mockRewardRepo.getPlayerRewards.mockResolvedValue([
			[
				{
					id: 1,
					playerId: 10,
					levelId: 2,
					coinsAmount: 1000,
					roomId: 5,
					status: RewardStatus.PENDING,
				},
			],
			1,
		]);

		const result = await core.listPlayerRewards(10, {
			status: RewardStatus.PENDING,
			take: 10,
			skip: 0,
		});

		expect(result.rewards).toHaveLength(1);
		expect(result.total).toBe(1);
		expect(mockRewardRepo.getPlayerRewards).toHaveBeenCalledWith(
			{
				status: RewardStatus.PENDING,
				take: 10,
				skip: 0,
			},
			10,
		);
	});
});
