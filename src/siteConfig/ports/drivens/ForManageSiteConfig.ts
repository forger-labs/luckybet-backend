import type { UploadableFile } from '../../../shared/storage/storage.port';
import type {
	AdminSiteConfig,
	PublicSiteConfig,
	UpdateSiteConfigInput,
} from '../../app/schemas/site-config.schema';

export interface ForManageSiteConfig {
	getPublicConfig(): Promise<PublicSiteConfig>;
	getAdminConfig(): Promise<AdminSiteConfig>;
	updateConfig(dto: UpdateSiteConfigInput): Promise<AdminSiteConfig>;
	updateLogo(file: UploadableFile): Promise<AdminSiteConfig>;
}
