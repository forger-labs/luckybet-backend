import type { Repository } from 'typeorm';

import type { ForCache } from '../../../shared/cache/ports/forCache.port';
import { SiteConfig } from '../../entities/site-config.entity';
import { SiteConfigRepoService } from './SiteConfigRepo.service';

describe('SiteConfigRepoService', () => {
	let repoMock: jest.Mocked<Repository<SiteConfig>>;
	let cacheMock: jest.Mocked<ForCache>;
	let service: SiteConfigRepoService;

	const mockEntity: SiteConfig = {
		id: 1,
		created_at: new Date('2026-01-01T00:00:00Z'),
		updated_at: new Date('2026-01-01T00:00:00Z'),
		adminPanelApiUrl: 'https://admin.test.com',
		clientPanelApiUrl: 'https://client.test.com',
		logoUrl: null,
		theme: 'midnight-harbor',
	};

	beforeEach(() => {
		repoMock = {
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
		} as unknown as jest.Mocked<Repository<SiteConfig>>;

		cacheMock = {
			get: jest.fn(),
			set: jest.fn(),
			del: jest.fn(),
		} as unknown as jest.Mocked<ForCache>;

		service = new SiteConfigRepoService(repoMock, cacheMock);
	});

	describe('getConfig', () => {
		it('returns cached entity if cache hits', async () => {
			cacheMock.get.mockResolvedValue(mockEntity);

			const result = await service.getConfig();

			expect(result).toEqual(mockEntity);
			expect(repoMock.findOne).not.toHaveBeenCalled();
		});

		it('queries DB and sets cache on cache miss', async () => {
			cacheMock.get.mockResolvedValue(null);
			repoMock.findOne.mockResolvedValue(mockEntity);

			const result = await service.getConfig();

			expect(result).toEqual(mockEntity);
			expect(repoMock.findOne).toHaveBeenCalledWith({ order: { id: 'ASC' } });
			expect(cacheMock.set).toHaveBeenCalledWith('site_config:global', mockEntity);
		});
	});

	describe('updateConfig', () => {
		it('updates existing entity, saves it, and invalidates cache', async () => {
			repoMock.findOne.mockResolvedValue({ ...mockEntity });
			repoMock.save.mockImplementation(async entity => entity as SiteConfig);

			const result = await service.updateConfig({ theme: 'crimson' });

			expect(result.theme).toBe('crimson');
			expect(repoMock.save).toHaveBeenCalled();
			expect(cacheMock.del).toHaveBeenCalledWith('site_config:global');
		});

		it('creates new entity if none exists, saves it, and invalidates cache', async () => {
			repoMock.findOne.mockResolvedValue(null);
			repoMock.create.mockReturnValue({ ...mockEntity, theme: 'crimson' });
			repoMock.save.mockImplementation(async entity => entity as SiteConfig);

			const result = await service.updateConfig({ theme: 'crimson' });

			expect(repoMock.create).toHaveBeenCalled();
			expect(repoMock.save).toHaveBeenCalled();
			expect(cacheMock.del).toHaveBeenCalledWith('site_config:global');
			expect(result.theme).toBe('crimson');
		});
	});
});
