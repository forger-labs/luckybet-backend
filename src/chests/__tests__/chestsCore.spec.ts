import { NotFoundException } from '@nestjs/common';

import type { StorageService, UploadableFile } from '../../shared/storage/storage.port';
import { ChestsCore } from '../app/chestsCore';
import { ChestPeriodType } from '../app/enums';
import type { ForDatabaseChests } from '../ports/driver/ForDatabaseChests';

describe('ChestsCore', () => {
	let core: ChestsCore;
	let mockRepo: jest.Mocked<ForDatabaseChests>;
	let mockStorage: jest.Mocked<StorageService>;

	const mockChest = {
		id: 1,
		title: 'Cofre Semanal',
		description: 'Completa 5 misiones',
		periodType: ChestPeriodType.WEEKLY,
		requiredMissions: 5,
		coinsAmount: 500,
		roomId: 2,
		experiencePoints: 100,
		imageUrl: 'chests/chest1.png',
		isActive: true,
	};

	beforeEach(() => {
		mockRepo = {
			createChest: jest.fn(),
			findById: jest.fn(),
			updateChest: jest.fn(),
			getChests: jest.fn(),
		};

		mockStorage = {
			buildPublicUrl: jest.fn((key: string) => `https://cdn.example.com/${key}`),
			uploadImage: jest.fn(),
			replaceImage: jest.fn(),
			deleteImage: jest.fn(),
		};

		core = new ChestsCore(mockRepo, mockStorage);
	});

	describe('createChest', () => {
		it('debería crear un cofre sin imagen y retornar con URL pública', async () => {
			mockRepo.createChest.mockResolvedValue(mockChest);

			const result = await core.createChest({
				title: 'Cofre Semanal',
				periodType: ChestPeriodType.WEEKLY,
				requiredMissions: 5,
				coinsAmount: 500,
				roomId: 2,
				experiencePoints: 100,
				isActive: true,
			});

			expect(mockRepo.createChest).toHaveBeenCalledWith({
				title: 'Cofre Semanal',
				periodType: ChestPeriodType.WEEKLY,
				requiredMissions: 5,
				coinsAmount: 500,
				roomId: 2,
				experiencePoints: 100,
				isActive: true,
				imageUrl: undefined,
			});
			expect(result.imageUrl).toBe('https://cdn.example.com/chests/chest1.png');
			expect(result.roomId).toBe(2);
		});

		it('debería subir imagen si se suministra un archivo válido', async () => {
			const validFile: UploadableFile = {
				buffer: Buffer.from('fake'),
				filename: 'chest.png',
				mimetype: 'image/png',
			};

			mockStorage.uploadImage.mockResolvedValue('chests/uploaded.png');
			mockRepo.createChest.mockResolvedValue({
				...mockChest,
				imageUrl: 'chests/uploaded.png',
			});

			const result = await core.createChest(
				{
					title: 'Cofre Semanal',
					periodType: ChestPeriodType.WEEKLY,
					requiredMissions: 5,
					coinsAmount: 500,
					roomId: 2,
					experiencePoints: 100,
					isActive: true,
				},
				validFile,
			);

			expect(mockStorage.uploadImage).toHaveBeenCalledWith(validFile, 'missions');
			expect(result.imageUrl).toBe('https://cdn.example.com/chests/uploaded.png');
		});
	});

	describe('getChest', () => {
		it('debería lanzar NotFoundException si no existe el cofre', async () => {
			mockRepo.findById.mockResolvedValue(null);

			await expect(core.getChest(99)).rejects.toThrow(NotFoundException);
		});

		it('debería devolver el cofre con URL formateada', async () => {
			mockRepo.findById.mockResolvedValue(mockChest);

			const result = await core.getChest(1);

			expect(result.id).toBe(1);
			expect(result.imageUrl).toBe('https://cdn.example.com/chests/chest1.png');
			expect(result.roomId).toBe(2);
		});
	});
});
