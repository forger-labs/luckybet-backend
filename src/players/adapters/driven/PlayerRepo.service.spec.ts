import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { LEVELS_CORE_PROVIDER } from '@/src/levels/app/constants';
import type { LevelType } from '@/src/levels/app/dto/level.schema';
import type { ForManageLevels } from '@/src/levels/ports/drivens/forManageLevels';
import { Player } from '../../app/entities/player.entity';
import { PlayerRepoService } from '../driven/PlayerRepo.service';

describe('PlayerRepoService', () => {
	let service: PlayerRepoService;
	let playerRepoMock: jest.Mocked<Repository<Player>>;
	let levelsCoreMock: jest.Mocked<ForManageLevels>;

	const mockLowestLevel: LevelType = {
		id: 1,
		name: 'Nivel 1 Base',
		image: 'https://cdn.example.com/lvl1.png',
		minExperience: 0,
		coins: 100,
		bonus: null,
	};

	const mockPlayerEntity: Player = {
		id: 1,
		username: 'testplayer',
		phone: '12345678',
		isActive: true,
		levelId: 1,
		experience: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	} as unknown as Player;

	beforeEach(async () => {
		playerRepoMock = {
			create: jest.fn(),
			save: jest.fn(),
			findOne: jest.fn(),
			findAndCount: jest.fn(),
		} as unknown as jest.Mocked<Repository<Player>>;

		levelsCoreMock = {
			getLowestLevel: jest.fn(),
			createLevel: jest.fn(),
			updateLevel: jest.fn(),
			getLevelById: jest.fn(),
			getLevels: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PlayerRepoService,
				{
					provide: getRepositoryToken(Player),
					useValue: playerRepoMock,
				},
				{
					provide: LEVELS_CORE_PROVIDER,
					useValue: levelsCoreMock,
				},
			],
		}).compile();

		service = module.get<PlayerRepoService>(PlayerRepoService);
	});

	describe('createPlayer', () => {
		it('should automatically fetch and assign the lowest level via LevelsCore (Redis cache) when levelId is not provided', async () => {
			levelsCoreMock.getLowestLevel.mockResolvedValueOnce(mockLowestLevel);
			playerRepoMock.create.mockReturnValueOnce({
				...mockPlayerEntity,
				levelId: 1,
			});
			playerRepoMock.save.mockResolvedValueOnce({
				...mockPlayerEntity,
				levelId: 1,
			});

			const result = await service.createPlayer({
				username: 'testplayer',
				phone: '12345678',
				isActive: true,
			});

			expect(levelsCoreMock.getLowestLevel).toHaveBeenCalled();
			expect(playerRepoMock.create).toHaveBeenCalledWith({
				username: 'testplayer',
				phone: '12345678',
				isActive: true,
				levelId: 1,
			});
			expect(result.levelId).toBe(1);
			expect(result.level).toMatchObject({
				id: 1,
				name: 'Nivel 1 Base',
			});
		});

		it('should keep explicit levelId if provided during creation without querying lowest level', async () => {
			playerRepoMock.create.mockReturnValueOnce({
				...mockPlayerEntity,
				levelId: 5,
			});
			playerRepoMock.save.mockResolvedValueOnce({
				...mockPlayerEntity,
				levelId: 5,
			});

			const result = await service.createPlayer({
				username: 'testplayer',
				levelId: 5,
				isActive: true,
			});

			expect(levelsCoreMock.getLowestLevel).not.toHaveBeenCalled();
			expect(playerRepoMock.create).toHaveBeenCalledWith(
				expect.objectContaining({
					levelId: 5,
				}),
			);
			expect(result.levelId).toBe(5);
		});

		it('should handle table levels empty gracefully by leaving levelId null', async () => {
			levelsCoreMock.getLowestLevel.mockResolvedValueOnce(null);
			playerRepoMock.create.mockReturnValueOnce({
				...mockPlayerEntity,
			});
			playerRepoMock.save.mockResolvedValueOnce({
				...mockPlayerEntity,
				levelId: null as unknown as number,
			});

			const result = await service.createPlayer({
				username: 'testplayer',
				isActive: true,
			});

			expect(levelsCoreMock.getLowestLevel).toHaveBeenCalled();
			expect(result.levelId).toBeNull();
		});
	});

	describe('findByUnique', () => {
		it('should find player by unique fields with level relation', async () => {
			playerRepoMock.findOne.mockResolvedValueOnce({
				...mockPlayerEntity,
				level: mockLowestLevel as unknown as Player['level'],
			});

			const result = await service.findByUnique({ username: 'testplayer' });

			expect(result).not.toBeNull();
			expect(result?.username).toBe('testplayer');
			expect(result?.level?.name).toBe('Nivel 1 Base');
		});
	});
});
