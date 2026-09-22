import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { ForCache } from '@/src/shared/cache/ports/forCache.port';
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

	const mockLevel: LevelType = {
		id: 1,
		name: 'Nivel Bronce',
		image: 'https://cdn.example.com/bronze.png',
		minExperience: 0,
		coins: 100,
		bonus: BonusIntern.Thirty,
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
		};

		core = new LevelsCore(repoMock, cacheMock);
	});

	describe('createLevel', () => {
		it('should create level successfully and invalidate Redis cache', async () => {
			repoMock.createLevel.mockResolvedValueOnce(mockLevel);

			const result = await core.createLevel({
				name: 'Nivel Bronce',
				image: 'https://cdn.example.com/bronze.png',
				minExperience: 0,
				coins: 100,
				bonus: BonusIntern.Thirty,
			});

			expect(result).toEqual(mockLevel);
			expect(repoMock.createLevel).toHaveBeenCalled();
			expect(cacheMock.del).toHaveBeenCalledWith(LUCKYBET_LOWEST_LEVEL_CACHE_KEY);
		});

		it('should throw BadRequestException if minExperience or coins are negative', async () => {
			await expect(
				core.createLevel({
					name: 'Invalido',
					image: 'img.png',
					minExperience: -1,
					coins: 100,
					bonus: null,
				}),
			).rejects.toThrow(BadRequestException);

			await expect(
				core.createLevel({
					name: 'Invalido',
					image: 'img.png',
					minExperience: 0,
					coins: -50,
					bonus: null,
				}),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('updateLevel', () => {
		it('should update level successfully and invalidate Redis cache', async () => {
			const updatedLevel = { ...mockLevel, name: 'Nivel Plata' };
			repoMock.updateLevel.mockResolvedValueOnce(updatedLevel);

			const result = await core.updateLevel(1, { name: 'Nivel Plata' });

			expect(result.name).toBe('Nivel Plata');
			expect(repoMock.updateLevel).toHaveBeenCalledWith(1, {
				name: 'Nivel Plata',
			});
			expect(cacheMock.del).toHaveBeenCalledWith(LUCKYBET_LOWEST_LEVEL_CACHE_KEY);
		});

		it('should throw NotFoundException if level does not exist', async () => {
			repoMock.updateLevel.mockResolvedValueOnce(null);

			await expect(core.updateLevel(99, { name: 'X' })).rejects.toThrow(
				NotFoundException,
			);
		});

		it('should throw BadRequestException if update contains negative numbers', async () => {
			await expect(core.updateLevel(1, { minExperience: -10 })).rejects.toThrow(
				BadRequestException,
			);
		});
	});

	describe('getLevelById', () => {
		it('should return level if found', async () => {
			repoMock.findById.mockResolvedValueOnce(mockLevel);

			const result = await core.getLevelById(1);

			expect(result).toEqual(mockLevel);
			expect(repoMock.findById).toHaveBeenCalledWith(1);
		});

		it('should throw NotFoundException if not found', async () => {
			repoMock.findById.mockResolvedValueOnce(null);

			await expect(core.getLevelById(99)).rejects.toThrow(NotFoundException);
		});
	});

	describe('getLevels', () => {
		it('should return list of levels with pagination', async () => {
			repoMock.findAll.mockResolvedValueOnce([[mockLevel], 1]);

			const result = await core.getLevels({ take: 10, skip: 0 });

			expect(result.levels).toHaveLength(1);
			expect(result.total).toBe(1);
			expect(result.limit).toBe(10);
			expect(result.skip).toBe(0);
		});
	});

	describe('getLowestLevel (Caché en Redis)', () => {
		it('should return level directly from Redis cache if available without querying DB', async () => {
			cacheMock.get.mockResolvedValueOnce(mockLevel);

			const result = await core.getLowestLevel();

			expect(result).toEqual(mockLevel);
			expect(cacheMock.get).toHaveBeenCalledWith(LUCKYBET_LOWEST_LEVEL_CACHE_KEY);
			expect(repoMock.findLowestLevel).not.toHaveBeenCalled();
		});

		it('should fetch from DB and save in Redis when cache misses', async () => {
			cacheMock.get.mockResolvedValueOnce(null);
			repoMock.findLowestLevel.mockResolvedValueOnce(mockLevel);

			const result = await core.getLowestLevel();

			expect(result).toEqual(mockLevel);
			expect(repoMock.findLowestLevel).toHaveBeenCalled();
			expect(cacheMock.set).toHaveBeenCalledWith(
				LUCKYBET_LOWEST_LEVEL_CACHE_KEY,
				mockLevel,
				DEFAULT_LOWEST_LEVEL_CACHE_TTL_SECONDS,
			);
		});
	});
});
