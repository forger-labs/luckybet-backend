import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { STORAGE_SERVICE } from '../../shared/storage/storage.constants';
import type { StorageService, UploadableFile } from '../../shared/storage/storage.port';
import type { SiteConfig } from '../entities/site-config.entity';
import type { ForManageSiteConfig } from '../ports/drivens/ForManageSiteConfig';
import type { ForDatabaseSiteConfig } from '../ports/drivers/ForDatabaseSiteConfig';
import { FOR_DATABASE_SITE_CONFIG } from './constants';
import type {
	AdminSiteConfig,
	PublicSiteConfig,
	UpdateSiteConfigInput,
} from './schemas/site-config.schema';

@Injectable()
export class SiteConfigCore implements ForManageSiteConfig {
	constructor(
		@Inject(FOR_DATABASE_SITE_CONFIG)
		private readonly repo: ForDatabaseSiteConfig,
		@Inject(STORAGE_SERVICE)
		private readonly storageService: StorageService,
	) {}

	private formatDate(date: Date | string | number): string {
		if (date instanceof Date) {
			return date.toISOString();
		}
		return new Date(date).toISOString();
	}

	private toAdminConfig(entity: SiteConfig): AdminSiteConfig {
		return {
			id: entity.id,
			created_at: this.formatDate(entity.created_at),
			updated_at: this.formatDate(entity.updated_at),
			admin_panel_api_url: entity.adminPanelApiUrl,
			client_panel_api_url: entity.clientPanelApiUrl,
			logo_url: this.storageService.buildPublicUrl(entity.logoUrl ?? ""),
			theme: entity.theme,
		};
	}

	private toPublicConfig(entity: SiteConfig): PublicSiteConfig {
		return {
			id: entity.id,
			created_at: this.formatDate(entity.created_at),
			updated_at: this.formatDate(entity.updated_at),
			client_panel_api_url: entity.clientPanelApiUrl,
			logo_url: this.storageService.buildPublicUrl(entity.logoUrl ?? ""),
			theme: entity.theme,
		};
	}

	async getAdminConfig(): Promise<AdminSiteConfig> {
		const config = await this.repo.getConfig();
		if (!config) {
			throw new NotFoundException('Configuración del sitio no encontrada');
		}
		return this.toAdminConfig(config);
	}

	async getPublicConfig(): Promise<PublicSiteConfig> {
		const config = await this.repo.getConfig();
		if (!config) {
			throw new NotFoundException('Configuración del sitio no encontrada');
		}
		return this.toPublicConfig(config);
	}

	async updateConfig(dto: UpdateSiteConfigInput): Promise<AdminSiteConfig> {
		const adminUrl = dto.admin_panel_api_url ?? dto.adminPanelApiUrl;
		const clientUrl = dto.client_panel_api_url ?? dto.clientPanelApiUrl;
		const logoUrl = dto.logo_url ?? dto.logoUrl;

		const patch: Partial<SiteConfig> = {};
		if (adminUrl !== undefined) {
			patch.adminPanelApiUrl = adminUrl.trim();
		}
		if (clientUrl !== undefined) {
			patch.clientPanelApiUrl = clientUrl.trim();
		}
		if (logoUrl !== undefined) {
			patch.logoUrl = logoUrl ? logoUrl.trim() : null;
		}
		if (dto.theme !== undefined) {
			patch.theme = dto.theme.trim();
		}

		const updated = await this.repo.updateConfig(patch);
		return this.toAdminConfig(updated);
	}

	async updateLogo(file: UploadableFile): Promise<AdminSiteConfig> {
		const current = await this.repo.getConfig();

		let newLogoUrl: string;
		if (current?.logoUrl) {
			newLogoUrl = await this.storageService.replaceImage(
				file,
				'site-config',
				current.logoUrl,
			);
		} else {
			newLogoUrl = await this.storageService.uploadImage(file, 'site-config');
		}

		const updated = await this.repo.updateConfig({
			logoUrl: newLogoUrl,
		});

		return this.toAdminConfig(updated);
	}
}
