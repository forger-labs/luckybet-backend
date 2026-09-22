import { Test, type TestingModule } from '@nestjs/testing';

import { BonusIntern } from '@/src/types/bonus';
import { LEVELS_CORE_PROVIDER } from '../../app/constants';
import type { LevelType } from '../../app/dto/level.schema';
import type { ForManageLevels } from '../../ports/drivens/forManageLevels';
import { LevelsController } from './levels.controller';

describe('LevelsController', () => {
	let controller: LevelsController;
	let coreMock: jest.Mocked<ForManageLevels>;

	const mockLevel: LevelType = {
		id: 1,
		name: 'Nivel Bronce',
		image: 'https://cdn.example.com/bronze.png',
		minExperience: 0,
		coins: 100,
		bonus: BonusIntern.Thirty,
	};

	beforeEach(async () => {
		coreMock = {
			createLevel: jest.fn(),
			updateLevel: jest.fn(),
			getLevelById: jest.fn(),
			getLevels: jest.fn(),
			getLowestLevel: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [LevelsController],
			providers: [
				{
					provide: LEVELS_CORE_PROVIDER,
					useValue: coreMock,
				},
			],
		}).compile();

		controller = module.get<LevelsController>(LevelsController);
	});

	describe('create', () => {
		it('should create a level and wrap in standard response', async () => {
			coreMock.createLevel.mockResolvedValueOnce(mockLevel);

			const result = await controller.create({
				name: 'Nivel Bronce',
				image: 'https://cdn.example.com/bronze.png',
				minExperience: 0,
				coins: 100,
				bonus: BonusIntern.Thirty,
			});

			expect(result.status).toBe(true);
			expect(result.data).toEqual(mockLevel);
			expect(result.message).toBe('Nivel creado exitosamente');
		});
	});

	describe('update', () => {
		it('should update a level and wrap in standard response', async () => {
			const updated = { ...mockLevel, name: 'Nivel Plata' };
			coreMock.updateLevel.mockResolvedValueOnce(updated);

			const result = await controller.update(1, { name: 'Nivel Plata' });

			expect(result.status).toBe(true);
			expect(result.data?.name).toBe('Nivel Plata');
			expect(result.message).toBe('Nivel actualizado exitosamente');
		});
	});

	describe('findAll', () => {
		it('should return paginated list of levels', async () => {
			coreMock.getLevels.mockResolvedValueOnce({
				levels: [mockLevel],
				total: 1,
				limit: 10,
				skip: 0,
			});

			const result = await controller.findAll(10, 0, { name: 'Bronce' });

			expect(result.status).toBe(true);
			expect(result.data).toHaveLength(1);
			expect(result.meta).toEqual(
				expect.objectContaining({
					limit: 10,
					total: 1,
				}),
			);
		});
	});

	describe('findOne', () => {
		it('should return single level', async () => {
			coreMock.getLevelById.mockResolvedValueOnce(mockLevel);

			const result = await controller.findOne(1);

			expect(result.status).toBe(true);
			expect(result.data).toEqual(mockLevel);
			expect(result.message).toBe('Nivel obtenido exitosamente');
		});
	});
});
