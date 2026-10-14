import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSiteConfigTable1791400000000 implements MigrationInterface {
	name = 'CreateSiteConfigTable1791400000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "site_configurations" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "admin_panel_api_url" character varying(255) NOT NULL, "client_panel_api_url" character varying(255) NOT NULL, "logo_url" character varying(500), "theme" character varying(50) NOT NULL DEFAULT 'midnight-harbor', CONSTRAINT "PK_site_configurations_id" PRIMARY KEY ("id"))`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "site_configurations"`);
	}
}
