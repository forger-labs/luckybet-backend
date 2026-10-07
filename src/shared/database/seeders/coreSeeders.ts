import type { MigrationInterface, QueryRunner } from 'typeorm';

import { missionDown, missionSeeder } from './missionSeeder';
import { userAdminDown, userAdminSeeder } from './userAdminSeeder';

export class CoreSeeder1740000000000 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await userAdminSeeder(queryRunner);
		await missionSeeder(queryRunner);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await missionDown(queryRunner);
		await userAdminDown(queryRunner);
	}
}
