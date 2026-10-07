import type { MigrationInterface, QueryRunner } from 'typeorm';

import { userAdminDown, userAdminSeeder } from './userAdminSeeder';

export class CoreSeeder1740000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await userAdminSeeder(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await userAdminDown(queryRunner);
  }
}
