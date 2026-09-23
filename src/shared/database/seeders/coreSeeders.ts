import type { MigrationInterface, QueryRunner } from 'typeorm';

import { userAdminDown, userAdminSeeder } from './userAdminSeeder';

export class CoreSeeder1740000000000 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		// Los seeders legacy de auth (users) fueron eliminados junto con el módulo auth/
		await userAdminSeeder(queryRunner);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// No hay seeders que revertir
		await userAdminDown(queryRunner);
	}
}
