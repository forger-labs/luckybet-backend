process.env.TZ = 'UTC';

import { config } from 'dotenv';
import { DataSource } from 'typeorm';

import { buildTypeOrmConnectionOptions } from './databaseOptions';

config();

export default new DataSource({
	...buildTypeOrmConnectionOptions(),
	entities: ['src/**/*.entity.ts'],
	migrations: ['src/shared/database/migrations/*.ts'],
	logging: true,
});
