import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CACHE_PORT } from '../../../shared/cache/constants';
import type { ForCache } from '../../../shared/cache/ports/forCache.port';
import { SITE_CONFIG_CACHE_KEY } from '../../app/constants';
import { SiteConfig } from '../../entities/site-config.entity';
import type { ForDatabaseSiteConfig } from '../../ports/drivers/ForDatabaseSiteConfig';

@Injectable()
export class SiteConfigRepoService implements ForDatabaseSiteConfig {
	constructor(
		@InjectRepository(SiteConfig)
		private readonly siteConfigRepository: Repository<SiteConfig>,
		@Optional()
		@Inject(CACHE_PORT)
		private readonly cache?: ForCache,
	) {}

	async getConfig(): Promise<SiteConfig | null> {
		if (this.cache) {
			const cached = await this.cache.get<SiteConfig>(SITE_CONFIG_CACHE_KEY);
			if (cached) {
				return cached;
			}
		}

		const config = await this.siteConfigRepository.findOne({
			order: { id: 'ASC' },
		});

		if (config && this.cache) {
			await this.cache.set(SITE_CONFIG_CACHE_KEY, config);
		}

		return config;
	}

	async updateConfig(data: Partial<SiteConfig>): Promise<SiteConfig> {
		let config = await this.siteConfigRepository.findOne({
			order: { id: 'ASC' },
		});

		if (!config) {
			config = this.siteConfigRepository.create({
				adminPanelApiUrl: data.adminPanelApiUrl ?? '',
				clientPanelApiUrl: data.clientPanelApiUrl ?? '',
				logoUrl: data.logoUrl ?? null,
				theme: data.theme ?? 'midnight-harbor',
				...data,
			});
		} else {
			Object.assign(config, data);
		}

		const saved = await this.siteConfigRepository.save(config);

		if (this.cache) {
			await this.cache.del(SITE_CONFIG_CACHE_KEY);
		}

		return saved;
	}
}
