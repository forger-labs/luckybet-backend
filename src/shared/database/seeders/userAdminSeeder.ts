import { configDotenv } from 'dotenv';
import { QueryRunner } from 'typeorm';

import { AdminRoles, User } from '../../../users/app/entities/user.entity';

configDotenv();

export async function userAdminSeeder(queryRunner: QueryRunner) {
	const userAdminRepo = queryRunner.dataSource.getRepository(User);
	const username = process.env.ADMIN_USER ?? 'ala';
	const password = process.env.PASSWORD ?? '123456';
	const user = userAdminRepo.create({
		username,
		password,
		isActive: true,
		role: AdminRoles.SUPER_ADMIN,
	});
	await userAdminRepo.save(user);
}

export async function userAdminDown(queryRunner: QueryRunner) {
	const userAdminRepo = queryRunner.dataSource.getRepository(User);
	await userAdminRepo.clear();
}
