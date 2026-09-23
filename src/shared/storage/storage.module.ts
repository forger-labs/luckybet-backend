import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { S3StorageAdapter } from './s3-storage.adapter';
import { STORAGE_SERVICE } from './storage.constants';

@Global()
@Module({
	providers: [
		{
			provide: STORAGE_SERVICE,
			useFactory: (config: ConfigService) => new S3StorageAdapter(config),
			inject: [ConfigService],
		},
	],
	exports: [STORAGE_SERVICE],
})
export class StorageModule {}
