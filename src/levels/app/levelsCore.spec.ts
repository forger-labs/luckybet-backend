import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { ForCache } from '@/src/shared/cache/ports/forCache.port';
import type { StorageService, UploadableFile } from '@/src/shared/storage/storage.port';
import { BonusIntern } from '@/src/types/bonus';
import type { ForDatabaseLevels } from '../ports/drivers/forDatabaseLevels';
import {
	DEFAULT_LOWEST_LEVEL_CACHE_TTL_SECONDS,
	LUCKYBET_LOWEST_LEVEL_CACHE_KEY,
} from './constants';
import type { LevelType } from './dto/level.schema';
import { LevelsCore } from './levelsCore';

describe('LevelsCore', () => {
	let core: LevelsCore;
	let repoMock: jest.Mocked<ForDatabaseLevels>;
	let cacheMock: jest.Mocked<ForCache>;
	let storageMock: jest.Mocked<StorageService>;

	const mockFile: UploadableFile = {
		buffer: Buffer.from('test-image-content'),
		filename: 'bronce.png',
		mimetype: 'image/png',
	};

	const mockLevel: LevelType = {
		id: 1,
		name: 'Nivel Bronce',
		image: 'levels/bronce-key.png',
		minExperience: 0,
		coins: 100,
		roomId: 2,
	};

	beforeEach(() => {
		repoMock = {
			findById: jest.fn(),
			findAll: jest.fn(),
			findLowestLevel: jest.fn(),
			createLevel: jest.fn(),
			updateLevel: jest.fn(),
		};

		cacheMock = {
			get: jest.fn().mockResolvedValue(null),
			set: jest.fn().mockResolvedValue(undefined),
			del: jest.fn().mockResolvedValue(undefined),
			exists: jest.fn().mockResolvedValue(false),
			ttl: jest.fn().mockResolvedValue(3600),
			flushPattern: jest.fn().mockResolvedValue(0),
		};

		storageMock = {
			buildPublicUrl: jest
				.fn()
				.mockImplementation(key => `https://cdn.example.com/${key}`),
			uploadImage: jest.fn().mockResolvedValue('levels/bronce-key.png'),
			replaceImage: jest.fn().mockResolvedValue('levels/plata-key.png'),
			deleteImage: jest.fn().mockResolvedValue(undefined),
		};

		core = new LevelsCore(repoMock, cacheMock, storageMock);
	});

	describe('createLevel', () => {
		it('should upload image to S3, create level and return public URL', async () => {
			repoMock.createLevel.mockResolvedValueOnce(mockLevel);

			const result = await core.createLevel({
				name: 'Nivel Bronce',
				image: mockFile,
				minExperience: 0,
				coins: 100,
				roomId: 2,
			});

			expect(storageMock.uploadImage).toHaveBeenCalledWith(mockFile, 'levels');
			expect(repoMock.createLevel).toHaveBeenCalledWith({
				name: 'Nivel Bronce',
				image: 'levels/bronce-key.png',
				minExperience: 0,
				coins: 100,
				roomId: 2,
			});
			expect(cacheMock.del).toHaveBeenCalledWith(LUCKYBET_LOWEST_LEVEL_CACHE_KEY);
			expect(result.image).toBe('https://cdn.example.com/levels/bronce-key.png');
		});

		it('should rollback uploaded image in S3 if database creation fails', async () => {
			storageMock.uploadImage.mockResolvedValueOnce('levels/orphan-key.png');
			repoMock.createLevel.mockRejectedValueOnce(new Error('DB failure'));

			await expect(
				core.createLevel({
					name: 'Fallo DB',
					image: mockFile,
					minExperience: 0,
					coins: 100,
				}),
			).rejects.toThrow('DB failure');

			expect(storageMock.deleteImage).toHaveBeenCalledWith('levels/orphan-key.png');
		});

		it('should throw BadRequestException if minExperience or coins are negative', async () => {
			await expect(
				core.createLevel({
					name: 'Invalido',
					image: mockFile,
					minExperience: -1,
					coins: 100,
				}),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('updateLevel', () => {
		it('should replace image on S3 when a new image is provided', async () => {
			repoMock.findById.mockResolvedValueOnce(mockLevel);
			const updatedLevel = {
				...mockLevel,
				name: 'Nivel Plata',
				image: 'levels/plata-key.png',
			};
			repoMock.updateLevel.mockResolvedValueOnce(updatedLevel);

			const newFile: UploadableFile = {
				buffer: Buffer.from('plata'),
				filename: 'plata.png',
				mimetype: 'image/png',
			};

			const result = await core.updateLevel(1, {
				name: 'Nivel Plata',
				image: newFile,
			});

			expect(storageMock.replaceImage).toHaveBeenCalledWith(
				newFile,
				'levels',
				mockLevel.image,
			);
			expect(result.image).toBe('https://cdn.example.com/levels/plata-key.png');
			expect(cacheMock.del).toHaveBeenCalledWith(LUCKYBET_LOWEST_LEVEL_CACHE_KEY);
		});

		it('should keep existing image if no new image is provided on update', async () => {
			repoMock.findById.mockResolvedValueOnce(mockLevel);
			repoMock.updateLevel.mockResolvedValueOnce({
				...mockLevel,
				coins: 500,
			});

			const result = await core.updateLevel(1, { coins: 500 });

			expect(storageMock.replaceImage).not.toHaveBeenCalled();
			expect(repoMock.updateLevel).toHaveBeenCalledWith(
				1,
				expect.objectContaining({
					coins: 500,
					image: mockLevel.image,
				}),
			);
			expect(result.coins).toBe(500);
		});

		it('should throw NotFoundException if level does not exist', async () => {
			repoMock.findById.mockResolvedValueOnce(null);

			await expect(core.updateLevel(99, { name: 'X' })).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe('getLevelById', () => {
		it('should return level with public image URL', async () => {
			repoMock.findById.mockResolvedValueOnce(mockLevel);

			const result = await core.getLevelById(1);

			expect(result.image).toBe('https://cdn.example.com/levels/bronce-key.png');
		});

		it('should throw NotFoundException if not found', async () => {
			repoMock.findById.mockResolvedValueOnce(null);

			await expect(core.getLevelById(99)).rejects.toThrow(NotFoundException);
		});
	});

	describe('getLevels', () => {
		it('should return list of levels with public image URLs', async () => {
			repoMock.findAll.mockResolvedValueOnce([[mockLevel], 1]);

			const result = await core.getLevels({
				take: 10,
				skip: 0,
				filter: { sortOrder: 'DESC' },
			});

			expect(result.levels).toHaveLength(1);
			expect(result.levels[0].image).toBe(
				'https://cdn.example.com/levels/bronce-key.png',
			);
			expect(repoMock.findAll).toHaveBeenCalledWith(10, 0, {
				sortOrder: 'DESC',
			});
		});
	});

	describe('getLowestLevel (Caché en Redis)', () => {
		it('should return level from Redis cache and format public URL', async () => {
			cacheMock.get.mockResolvedValueOnce(mockLevel);

			const result = await core.getLowestLevel();

			expect(result?.image).toBe('https://cdn.example.com/levels/bronce-key.png');
			expect(cacheMock.get).toHaveBeenCalledWith(LUCKYBET_LOWEST_LEVEL_CACHE_KEY);
			expect(repoMock.findLowestLevel).not.toHaveBeenCalled();
		});

		it('should fetch from DB, save in Redis and return formatted public URL when cache misses', async () => {
			cacheMock.get.mockResolvedValueOnce(null);
			repoMock.findLowestLevel.mockResolvedValueOnce(mockLevel);

			const result = await core.getLowestLevel();

			expect(result?.image).toBe('https://cdn.example.com/levels/bronce-key.png');
			expect(repoMock.findLowestLevel).toHaveBeenCalled();
			expect(cacheMock.set).toHaveBeenCalledWith(
				LUCKYBET_LOWEST_LEVEL_CACHE_KEY,
				mockLevel,
				DEFAULT_LOWEST_LEVEL_CACHE_TTL_SECONDS,
			);
		});
	});
});
