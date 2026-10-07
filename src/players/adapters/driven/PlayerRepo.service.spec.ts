import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { Player } from '../../app/entities/player.entity';
import { PlayerRepoService } from '../driven/PlayerRepo.service';

describe('PlayerRepoService', () => {
	let service: PlayerRepoService;
	let playerRepoMock: jest.Mocked<Repository<Player>>;

	const mockPlayerEntity: Player = {
		id: 1,
		username: 'testplayer',
		phone: '12345678',
		isActive: true,
		levelId: 1,
		experience: 0,
		created_at: new Date(),
		updated_at: new Date(),
	} as unknown as Player;

	beforeEach(async () => {
		playerRepoMock = {
			create: jest.fn(),
			save: jest.fn(),
			update: jest.fn(),
			findOne: jest.fn(),
			findAndCount: jest.fn(),
		} as unknown as jest.Mocked<Repository<Player>>;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PlayerRepoService,
				{
					provide: getRepositoryToken(Player),
					useValue: playerRepoMock,
				},
			],
		}).compile();

		service = module.get<PlayerRepoService>(PlayerRepoService);
	});

	describe('createPlayer', () => {
		it('should create and save player with provided data', async () => {
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
				levelId: 1,
			});

			expect(playerRepoMock.create).toHaveBeenCalledWith({
				username: 'testplayer',
				phone: '12345678',
				isActive: true,
				experience: 0,
				levelId: 1,
				roomId: undefined,
			});
			expect(result.levelId).toBe(1);
			expect(result.username).toBe('testplayer');
		});
	});

	describe('updatePlayerById', () => {
		it('should call playerModel.update directly instead of save', async () => {
			playerRepoMock.update.mockResolvedValueOnce({
				affected: 1,
				raw: [],
				generatedMaps: [],
			});
			playerRepoMock.findOne.mockResolvedValueOnce(mockPlayerEntity);

			const result = await service.updatePlayerById(1, { phone: '99999999' });

			expect(playerRepoMock.update).toHaveBeenCalledWith(1, { phone: '99999999' });
			expect(playerRepoMock.save).not.toHaveBeenCalled();
			expect(result?.phone).toBe('12345678');
		});

		it('should return null if user does not exist', async () => {
			playerRepoMock.update.mockResolvedValueOnce({
				affected: 0,
				raw: [],
				generatedMaps: [],
			});
			playerRepoMock.findOne.mockResolvedValueOnce(null);

			const result = await service.updatePlayerById(999, { phone: '99999999' });

			expect(result).toBeNull();
		});
	});

	describe('addExperience', () => {
		it('should increment player experience using update and return new total', async () => {
			playerRepoMock.findOne
				.mockResolvedValueOnce({ id: 1, experience: 100 } as Player)
				.mockResolvedValueOnce({ ...mockPlayerEntity, experience: 150 });
			playerRepoMock.update.mockResolvedValueOnce({
				affected: 1,
				raw: [],
				generatedMaps: [],
			});

			const result = await service.addExperience(1, 50);

			expect(playerRepoMock.update).toHaveBeenCalledWith(1, { experience: 150 });
			expect(result.previousExperience).toBe(100);
			expect(result.newExperience).toBe(150);
		});
	});
});
