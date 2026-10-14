import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { STORAGE_SERVICE } from '../shared/storage/storage.constants';
import { StorageModule } from '../shared/storage/storage.module';
import type { StorageService } from '../shared/storage/storage.port';
import { SiteConfigRepoService } from './adapters/drivens/SiteConfigRepo.service';
import { SiteConfigController } from './adapters/drivers/siteConfig.controller';
import { FOR_DATABASE_SITE_CONFIG, SITE_CONFIG_CORE_PROVIDER } from './app/constants';
import { SiteConfigCore } from './app/siteConfigCore';
import { SiteConfig } from './entities/site-config.entity';
import type { ForDatabaseSiteConfig } from './ports/drivers/ForDatabaseSiteConfig';

@Module({
	imports: [TypeOrmModule.forFeature([SiteConfig]), StorageModule, AuthModule],
	controllers: [SiteConfigController],
	providers: [
		{
			provide: FOR_DATABASE_SITE_CONFIG,
			useClass: SiteConfigRepoService,
		},
		{
			provide: SITE_CONFIG_CORE_PROVIDER,
			useFactory: (repo: ForDatabaseSiteConfig, storage: StorageService) =>
				new SiteConfigCore(repo, storage),
			inject: [FOR_DATABASE_SITE_CONFIG, STORAGE_SERVICE],
		},
	],
	exports: [SITE_CONFIG_CORE_PROVIDER, FOR_DATABASE_SITE_CONFIG],
})
export class SiteConfigModule {}
