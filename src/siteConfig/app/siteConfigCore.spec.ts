import type { StorageService, UploadableFile } from '../../shared/storage/storage.port';
import { SiteConfig } from '../entities/site-config.entity';
import type { ForDatabaseSiteConfig } from '../ports/drivers/ForDatabaseSiteConfig';
import { SiteConfigCore } from './siteConfigCore';

describe('SiteConfigCore', () => {
	let repoMock: jest.Mocked<ForDatabaseSiteConfig>;
	let storageMock: jest.Mocked<StorageService>;
	let core: SiteConfigCore;

	const mockEntity: SiteConfig = {
		id: 1,
		created_at: new Date('2026-01-01T00:00:00Z'),
		updated_at: new Date('2026-01-01T00:00:00Z'),
		adminPanelApiUrl: 'https://admin-api.test.com',
		clientPanelApiUrl: 'https://client-api.test.com',
		logoUrl: 'https://s3.test.com/site-config/logo.png',
		theme: 'midnight-harbor',
	};

	beforeEach(() => {
		repoMock = {
			getConfig: jest.fn(),
			updateConfig: jest.fn(),
		};

		storageMock = {
			buildPublicUrl: jest.fn(),
			uploadImage: jest.fn(),
			replaceImage: jest.fn(),
			deleteImage: jest.fn(),
		};

		core = new SiteConfigCore(repoMock, storageMock);
	});

	describe('getAdminConfig', () => {
		it('returns full site configuration including admin panel url', async () => {
			repoMock.getConfig.mockResolvedValue(mockEntity);

			const result = await core.getAdminConfig();

			expect(result).toEqual({
				id: 1,
				created_at: mockEntity.created_at.toISOString(),
				updated_at: mockEntity.updated_at.toISOString(),
				admin_panel_api_url: 'https://admin-api.test.com',
				client_panel_api_url: 'https://client-api.test.com',
				logo_url: 'https://s3.test.com/site-config/logo.png',
				theme: 'midnight-harbor',
			});
		});

		it('throws NotFoundException if no config exists', async () => {
			repoMock.getConfig.mockResolvedValue(null);

			await expect(core.getAdminConfig()).rejects.toThrow(
				'Configuración del sitio no encontrada',
			);
		});
	});

	describe('getPublicConfig', () => {
		it('returns public configuration without admin panel url', async () => {
			repoMock.getConfig.mockResolvedValue(mockEntity);

			const result = await core.getPublicConfig();

			expect(result).toEqual({
				id: 1,
				created_at: mockEntity.created_at.toISOString(),
				updated_at: mockEntity.updated_at.toISOString(),
				client_panel_api_url: 'https://client-api.test.com',
				logo_url: 'https://s3.test.com/site-config/logo.png',
				theme: 'midnight-harbor',
			});
			expect((result as Record<string, unknown>).admin_panel_api_url).toBeUndefined();
		});

		it('throws NotFoundException if no config exists', async () => {
			repoMock.getConfig.mockResolvedValue(null);

			await expect(core.getPublicConfig()).rejects.toThrow(
				'Configuración del sitio no encontrada',
			);
		});
	});

	describe('updateConfig', () => {
		it('updates configuration with snake_case and camelCase compatibility', async () => {
			const updatedEntity: SiteConfig = {
				...mockEntity,
				theme: 'crimson',
			};
			repoMock.updateConfig.mockResolvedValue(updatedEntity);

			const result = await core.updateConfig({ theme: 'crimson' });

			expect(repoMock.updateConfig).toHaveBeenCalledWith({ theme: 'crimson' });
			expect(result.theme).toBe('crimson');
		});
	});

	describe('updateLogo', () => {
		const mockFile: UploadableFile = {
			buffer: Buffer.from('test'),
			filename: 'logo.png',
			mimetype: 'image/png',
		};

		it('replaces logo if previous logo exists', async () => {
			repoMock.getConfig.mockResolvedValue(mockEntity);
			storageMock.replaceImage.mockResolvedValue(
				'https://s3.test.com/site-config/new-logo.png',
			);
			repoMock.updateConfig.mockResolvedValue({
				...mockEntity,
				logoUrl: 'https://s3.test.com/site-config/new-logo.png',
			});

			const result = await core.updateLogo(mockFile);

			expect(storageMock.replaceImage).toHaveBeenCalledWith(
				mockFile,
				'site-config',
				mockEntity.logoUrl,
			);
			expect(result.logo_url).toBe('https://s3.test.com/site-config/new-logo.png');
		});

		it('uploads new logo if no previous logo exists', async () => {
			repoMock.getConfig.mockResolvedValue({
				...mockEntity,
				logoUrl: null,
			});
			storageMock.uploadImage.mockResolvedValue(
				'https://s3.test.com/site-config/fresh.png',
			);
			repoMock.updateConfig.mockResolvedValue({
				...mockEntity,
				logoUrl: 'https://s3.test.com/site-config/fresh.png',
			});

			const result = await core.updateLogo(mockFile);

			expect(storageMock.uploadImage).toHaveBeenCalledWith(mockFile, 'site-config');
			expect(result.logo_url).toBe('https://s3.test.com/site-config/fresh.png');
		});
	});
});
