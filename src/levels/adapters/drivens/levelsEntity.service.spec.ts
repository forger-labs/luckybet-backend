import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { BonusIntern } from '@/src/types/bonus';
import { LevelsEntity } from '../../app/entities/levels.entity';
import { LevelsEntityService } from '../drivens/levelsEntity.service';

describe('LevelsEntityService', () => {
	let service: LevelsEntityService;
	let repoMock: jest.Mocked<Repository<LevelsEntity>>;

	const mockLevelEntity: LevelsEntity = {
		id: 1,
		name: 'Nivel Bronce',
		image: 'https://cdn.example.com/bronze.png',
		minExperience: 0,
		coins: 100,
		roomId: 2,
		players: [],
		created_at: new Date(),
		updated_at: new Date(),
	} as LevelsEntity;

	beforeEach(async () => {
		repoMock = {
			findOne: jest.fn(),
			findAndCount: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
		} as unknown as jest.Mocked<Repository<LevelsEntity>>;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LevelsEntityService,
				{
					provide: getRepositoryToken(LevelsEntity),
					useValue: repoMock,
				},
			],
		}).compile();

		service = module.get<LevelsEntityService>(LevelsEntityService);
	});

	describe('findById', () => {
		it('should return level if found', async () => {
			repoMock.findOne.mockResolvedValueOnce(mockLevelEntity);

			const result = await service.findById(1);

			expect(result).toMatchObject({
				id: 1,
				name: 'Nivel Bronce',
				minExperience: 0,
				coins: 100,
			});
			expect(repoMock.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
		});

		it('should return null if not found', async () => {
			repoMock.findOne.mockResolvedValueOnce(null);

			const result = await service.findById(99);

			expect(result).toBeNull();
		});
	});

	describe('findLowestLevel', () => {
		it('should return the level with lowest minExperience', async () => {
			repoMock.findOne.mockResolvedValueOnce(mockLevelEntity);

			const result = await service.findLowestLevel();

			expect(result).toMatchObject({
				id: 1,
				minExperience: 0,
			});
			expect(repoMock.findOne).toHaveBeenCalledWith({
				where: {},
				order: {
					minExperience: 'ASC',
					id: 'ASC',
				},
			});
		});

		it('should return null if table is empty', async () => {
			repoMock.findOne.mockResolvedValueOnce(null);

			const result = await service.findLowestLevel();

			expect(result).toBeNull();
		});
	});

	describe('findAll', () => {
		it('should return paginated and filtered levels with order direction', async () => {
			repoMock.findAndCount.mockResolvedValueOnce([[mockLevelEntity], 1]);

			const [levels, total] = await service.findAll(10, 0, {
				name: 'Bronce',
				roomId: 2,
				minCoins: 50,
				maxCoins: 200,
				minExperience: 0,
				maxExperience: 500,
				sortOrder: 'DESC',
			});

			expect(levels).toHaveLength(1);
			expect(total).toBe(1);
			expect(repoMock.findAndCount).toHaveBeenCalledWith(
				expect.objectContaining({
					take: 10,
					skip: 0,
					order: {
						minExperience: 'DESC',
						id: 'DESC',
					},
				}),
			);
		});
	});

	describe('createLevel', () => {
		it('should create and save a new level', async () => {
			repoMock.create.mockReturnValueOnce(mockLevelEntity);
			repoMock.save.mockResolvedValueOnce(mockLevelEntity);

			const result = await service.createLevel({
				name: 'Nivel Bronce',
				image: 'https://cdn.example.com/bronze.png',
				minExperience: 0,
				coins: 100,
				roomId: 2,
			});

			expect(result.id).toBe(1);
			expect(repoMock.create).toHaveBeenCalledWith({
				name: 'Nivel Bronce',
				image: 'https://cdn.example.com/bronze.png',
				minExperience: 0,
				coins: 100,
				roomId: 2,
			});
			expect(repoMock.save).toHaveBeenCalled();
		});
	});

	describe('updateLevel', () => {
		it('should update and return existing level', async () => {
			repoMock.findOne.mockResolvedValueOnce(mockLevelEntity);
			repoMock.save.mockResolvedValueOnce({
				...mockLevelEntity,
				name: 'Nivel Plata',
			} as LevelsEntity);

			const result = await service.updateLevel(1, {
				name: 'Nivel Plata',
			});

			expect(result?.name).toBe('Nivel Plata');
		});

		it('should return null if level to update does not exist', async () => {
			repoMock.findOne.mockResolvedValueOnce(null);

			const result = await service.updateLevel(99, { name: 'X' });

			expect(result).toBeNull();
		});
	});
});
