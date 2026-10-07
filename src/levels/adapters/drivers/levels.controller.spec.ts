import { Test, type TestingModule } from '@nestjs/testing';

import type { UploadableFile } from '@/src/shared/storage/storage.port';
import { BonusIntern } from '@/src/types/bonus';
import { LEVELS_CORE_PROVIDER } from '../../app/constants';
import type { LevelType } from '../../app/dto/level.schema';
import type { ForManageLevels } from '../../ports/drivens/forManageLevels';
import { LevelsController } from './levels.controller';

describe('LevelsController', () => {
	let controller: LevelsController;
	let coreMock: jest.Mocked<ForManageLevels>;

	const mockFile: UploadableFile = {
		buffer: Buffer.from('img'),
		filename: 'level.png',
		mimetype: 'image/png',
	};

	const mockLevel: LevelType = {
		id: 1,
		name: 'Nivel Bronce',
		image: 'https://cdn.example.com/levels/bronce.png',
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
		it('should create a level with multipart payload and wrap in standard response', async () => {
			coreMock.createLevel.mockResolvedValueOnce(mockLevel);

			const result = await controller.create({
				name: 'Nivel Bronce',
				image: mockFile,
				minExperience: 0,
				coins: 100,
				bonus: BonusIntern.Thirty,
			});

			expect(result.status).toBe(true);
			expect(result.data).toEqual(mockLevel);
			expect(result.message).toBe('Nivel creado exitosamente');
			expect(coreMock.createLevel).toHaveBeenCalledWith({
				name: 'Nivel Bronce',
				image: mockFile,
				minExperience: 0,
				coins: 100,
				bonus: BonusIntern.Thirty,
			});
		});
	});

	describe('update', () => {
		it('should update a level with multipart payload and wrap in standard response', async () => {
			const updated = { ...mockLevel, name: 'Nivel Plata' };
			coreMock.updateLevel.mockResolvedValueOnce(updated);

			const result = await controller.update(1, {
				name: 'Nivel Plata',
				image: mockFile,
			});

			expect(result.status).toBe(true);
			expect(result.data?.name).toBe('Nivel Plata');
			expect(result.message).toBe('Nivel actualizado exitosamente');
			expect(coreMock.updateLevel).toHaveBeenCalledWith(1, {
				name: 'Nivel Plata',
				image: mockFile,
			});
		});
	});

	describe('findAll', () => {
		it('should return paginated list of levels with sortOrder', async () => {
			coreMock.getLevels.mockResolvedValueOnce({
				levels: [mockLevel],
				total: 1,
				limit: 10,
				skip: 0,
			});

			const result = await controller.findAll(10, 0, {
				name: 'Bronce',
				sortOrder: 'DESC',
			});

			expect(result.status).toBe(true);
			expect(result.data).toHaveLength(1);
			expect(coreMock.getLevels).toHaveBeenCalledWith({
				take: 10,
				skip: 0,
				filter: { name: 'Bronce', sortOrder: 'DESC' },
			});
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
