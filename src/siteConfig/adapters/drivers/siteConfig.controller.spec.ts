import { BadRequestException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import type { UploadableFile } from '../../../shared/storage/storage.port';
import type {
	AdminSiteConfig,
	PublicSiteConfig,
} from '../../app/schemas/site-config.schema';
import type { ForManageSiteConfig } from '../../ports/drivens/ForManageSiteConfig';
import { SiteConfigController } from './siteConfig.controller';

describe('SiteConfigController', () => {
	let controller: SiteConfigController;
	let coreMock: jest.Mocked<ForManageSiteConfig>;

	const mockAdminConfig: AdminSiteConfig = {
		id: 1,
		created_at: new Date().toUTCString(),
		updated_at: new Date().toUTCString(),
		admin_panel_api_url: 'https://admin.test.com',
		client_panel_api_url: 'https://client.test.com',
		logo_url: 'https://test.com/logo.png',
		theme: 'midnight-harbor',
	};

	const mockPublicConfig: PublicSiteConfig = {
		id: 1,
		created_at: new Date().toUTCString(),
		updated_at: new Date().toUTCString(),
		client_panel_api_url: 'https://client.test.com',
		logo_url: 'https://test.com/logo.png',
		theme: 'midnight-harbor',
	};

	beforeEach(() => {
		coreMock = {
			getPublicConfig: jest.fn(),
			getAdminConfig: jest.fn(),
			updateConfig: jest.fn(),
			updateLogo: jest.fn(),
		};

		controller = new SiteConfigController(coreMock);
	});

	describe('getPublicConfig', () => {
		it('returns public config wrapped in response envelope', async () => {
			coreMock.getPublicConfig.mockResolvedValue(mockPublicConfig);

			const result = await controller.getPublicConfig();

			expect(result.data).toEqual(mockPublicConfig);
			expect(result.status).toBe(true);
		});
	});

	describe('getAdminConfig', () => {
		it('returns admin config wrapped in response envelope', async () => {
			coreMock.getAdminConfig.mockResolvedValue(mockAdminConfig);

			const result = await controller.getAdminConfig();

			expect(result.data).toEqual(mockAdminConfig);
			expect(result.status).toBe(true);
		});
	});

	describe('updateConfig', () => {
		it('calls core updateConfig and returns response envelope', async () => {
			coreMock.updateConfig.mockResolvedValue({
				...mockAdminConfig,
				theme: 'crimson',
			});

			const result = await controller.updateConfig({ theme: 'crimson' });

			expect(coreMock.updateConfig).toHaveBeenCalledWith({ theme: 'crimson' });
			expect(result.data.theme).toBe('crimson');
			expect(result.status).toBe(true);
		});
	});

	describe('uploadLogo', () => {
		it('throws BadRequestException if no file is provided', async () => {
			const req = { body: {} } as FastifyRequest;

			await expect(controller.uploadLogo(req)).rejects.toThrow(BadRequestException);
		});

		it('calls core updateLogo with file and returns response envelope', async () => {
			const mockFile: UploadableFile = {
				buffer: Buffer.from('test'),
				filename: 'logo.png',
				mimetype: 'image/png',
			};
			const req = { body: { file: mockFile } } as unknown as FastifyRequest;

			coreMock.updateLogo.mockResolvedValue({
				...mockAdminConfig,
				logo_url: 'https://test.com/new.png',
			});

			const result = await controller.uploadLogo(req);

			expect(coreMock.updateLogo).toHaveBeenCalledWith(mockFile);
			expect(result.data.logo_url).toBe('https://test.com/new.png');
			expect(result.status).toBe(true);
		});
	});
});
