import type { SiteConfig } from '../../entities/site-config.entity';

export interface ForDatabaseSiteConfig {
	getConfig(): Promise<SiteConfig | null>;
	updateConfig(data: Partial<SiteConfig>): Promise<SiteConfig>;
}
