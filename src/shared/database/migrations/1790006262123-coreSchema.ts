import { MigrationInterface, QueryRunner } from 'typeorm';

export class CoreSchema1790006262123 implements MigrationInterface {
	name = 'CoreSchema1790006262123';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "public"."admin_users_role_enum" AS ENUM('SUPER_ADMIN', 'REVIEWER')`,
		);
		await queryRunner.query(
			`CREATE TABLE "admin_users" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "username" character varying NOT NULL, "password" character varying NOT NULL, "role" "public"."admin_users_role_enum" NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_2873882c38e8c07d98cb64f962d" UNIQUE ("username"), CONSTRAINT "PK_06744d221bb6145dc61e5dc441d" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "players" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "username" character varying(100) NOT NULL, "phone" character varying(20), "is_active" boolean NOT NULL DEFAULT true, "created_by" integer, "updated_by" integer, "level_id" integer, "experience" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_0ba988c87a279b5067d273c5924" UNIQUE ("username"), CONSTRAINT "PK_de22b8fdeee0c33ab55ae71da3b" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TYPE "public"."levels_bonus_enum" AS ENUM('0', '30', '40', '50', '100', '150', '200')`,
		);
		await queryRunner.query(
			`CREATE TABLE "levels" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "image" character varying(500) NOT NULL, "min_experience" integer NOT NULL, "coins" integer NOT NULL, "bonus" "public"."levels_bonus_enum", CONSTRAINT "PK_05f8dd8f715793c64d49e3f1901" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TYPE "public"."missions_type_enum" AS ENUM('DAILY', 'WEEKLY', 'FIXED')`,
		);
		await queryRunner.query(
			`CREATE TYPE "public"."missions_status_enum" AS ENUM('INACTIVE', 'ACTIVE', 'COMPLETED', 'CANCELLED')`,
		);
		await queryRunner.query(
			`CREATE TABLE "missions" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "title" character varying(200) NOT NULL, "description" text, "type" "public"."missions_type_enum" NOT NULL, "status" "public"."missions_status_enum" NOT NULL DEFAULT 'INACTIVE', "coins_amount" integer NOT NULL, "bonus" integer, "experience_points" integer NOT NULL, "image_url" character varying(500), "activated_at" TIMESTAMP, "expires_at" TIMESTAMP, "created_by" integer, "updated_by" integer, CONSTRAINT "PK_787aebb1ac5923c9904043c6309" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TYPE "public"."mission_steps_type_enum" AS ENUM('IMAGE', 'TEXT')`,
		);
		await queryRunner.query(
			`CREATE TABLE "mission_steps" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "mission_id" integer NOT NULL, "step_order" integer NOT NULL, "type" "public"."mission_steps_type_enum" NOT NULL, "content" text, CONSTRAINT "PK_4aaf0ff3de31918f1a10ca6bd93" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_bdc56231232e1ec51b3a3f7363" ON "mission_steps"  ("mission_id", "step_order") `,
		);
		await queryRunner.query(
			`CREATE TYPE "public"."user_missions_status_enum" AS ENUM('IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'CANCELLED')`,
		);
		await queryRunner.query(
			`CREATE TABLE "user_missions" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "player_id" integer NOT NULL, "mission_id" integer NOT NULL, "status" "public"."user_missions_status_enum" NOT NULL DEFAULT 'IN_PROGRESS', "current_step" integer NOT NULL DEFAULT '1', "started_at" TIMESTAMP NOT NULL DEFAULT NOW(), "completed_at" TIMESTAMP, CONSTRAINT "PK_252d92542f9926e799c0161ac46" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TYPE "public"."user_mission_steps_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`,
		);
		await queryRunner.query(
			`CREATE TABLE "user_mission_steps" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "user_mission_id" integer NOT NULL, "mission_step_id" integer NOT NULL, "status" "public"."user_mission_steps_status_enum" NOT NULL DEFAULT 'PENDING', "submission_text" text, "submission_image_url" character varying(500), "reviewed_by" integer, "reviewed_at" TIMESTAMP, "reviewer_notes" text, CONSTRAINT "PK_5149d664bd78232376a5430394c" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_82fae97c45fe22fe31c6f95d31" ON "user_mission_steps"  ("user_mission_id", "mission_step_id") `,
		);
		await queryRunner.query(
			`ALTER TABLE "players" ADD CONSTRAINT "FK_99b646f718dd89ef6e27e5d89f5" FOREIGN KEY ("created_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "players" ADD CONSTRAINT "FK_9668b931501a0bbdb2842d5c7d5" FOREIGN KEY ("updated_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "players" ADD CONSTRAINT "FK_f7a2eabf8f2f018cf9f82364f03" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "missions" ADD CONSTRAINT "FK_646a538da0408b13f96def7e814" FOREIGN KEY ("created_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "missions" ADD CONSTRAINT "FK_6c51c42626850e6f11e7a449c95" FOREIGN KEY ("updated_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "mission_steps" ADD CONSTRAINT "FK_af84531836b9b870505615c852d" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_missions" ADD CONSTRAINT "FK_3be9f8da02f117c437f7c9ae420" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_missions" ADD CONSTRAINT "FK_49c3f14415ed531190d7266f860" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_mission_steps" ADD CONSTRAINT "FK_2780812f15be2f50734129b46d2" FOREIGN KEY ("user_mission_id") REFERENCES "user_missions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_mission_steps" ADD CONSTRAINT "FK_72950f9a82850f9b082bc9c4461" FOREIGN KEY ("mission_step_id") REFERENCES "mission_steps"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_mission_steps" ADD CONSTRAINT "FK_8edd0b706773dbac0103c2eadc7" FOREIGN KEY ("reviewed_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "user_mission_steps" DROP CONSTRAINT "FK_8edd0b706773dbac0103c2eadc7"`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_mission_steps" DROP CONSTRAINT "FK_72950f9a82850f9b082bc9c4461"`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_mission_steps" DROP CONSTRAINT "FK_2780812f15be2f50734129b46d2"`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_missions" DROP CONSTRAINT "FK_49c3f14415ed531190d7266f860"`,
		);
		await queryRunner.query(
			`ALTER TABLE "user_missions" DROP CONSTRAINT "FK_3be9f8da02f117c437f7c9ae420"`,
		);
		await queryRunner.query(
			`ALTER TABLE "mission_steps" DROP CONSTRAINT "FK_af84531836b9b870505615c852d"`,
		);
		await queryRunner.query(
			`ALTER TABLE "missions" DROP CONSTRAINT "FK_6c51c42626850e6f11e7a449c95"`,
		);
		await queryRunner.query(
			`ALTER TABLE "missions" DROP CONSTRAINT "FK_646a538da0408b13f96def7e814"`,
		);
		await queryRunner.query(
			`ALTER TABLE "players" DROP CONSTRAINT "FK_f7a2eabf8f2f018cf9f82364f03"`,
		);
		await queryRunner.query(
			`ALTER TABLE "players" DROP CONSTRAINT "FK_9668b931501a0bbdb2842d5c7d5"`,
		);
		await queryRunner.query(
			`ALTER TABLE "players" DROP CONSTRAINT "FK_99b646f718dd89ef6e27e5d89f5"`,
		);
		await queryRunner.query(`DROP INDEX "public"."IDX_82fae97c45fe22fe31c6f95d31"`);
		await queryRunner.query(`DROP TABLE "user_mission_steps"`);
		await queryRunner.query(`DROP TYPE "public"."user_mission_steps_status_enum"`);
		await queryRunner.query(`DROP TABLE "user_missions"`);
		await queryRunner.query(`DROP TYPE "public"."user_missions_status_enum"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_bdc56231232e1ec51b3a3f7363"`);
		await queryRunner.query(`DROP TABLE "mission_steps"`);
		await queryRunner.query(`DROP TYPE "public"."mission_steps_type_enum"`);
		await queryRunner.query(`DROP TABLE "missions"`);
		await queryRunner.query(`DROP TYPE "public"."missions_status_enum"`);
		await queryRunner.query(`DROP TYPE "public"."missions_type_enum"`);
		await queryRunner.query(`DROP TABLE "levels"`);
		await queryRunner.query(`DROP TYPE "public"."levels_bonus_enum"`);
		await queryRunner.query(`DROP TABLE "players"`);
		await queryRunner.query(`DROP TABLE "admin_users"`);
		await queryRunner.query(`DROP TYPE "public"."admin_users_role_enum"`);
	}
}
