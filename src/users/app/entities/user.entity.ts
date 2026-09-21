import bcrypt from 'bcrypt';
import { BeforeInsert, BeforeUpdate, Column, Entity } from 'typeorm';

import { BaseEntity } from '../../../shared/entities/base.entity';

export enum AdminRoles {
	SUPER_ADMIN = 'SUPER_ADMIN',
	REVIEWER = 'REVIEWER',
}

@Entity('admin_users')
export class User extends BaseEntity {
	@Column({
		type: 'varchar',
		nullable: false,
		unique: true,
	})
	username!: string;

	@Column({
		type: 'varchar',
		nullable: false,
		select: false,
	})
	password!: string;

	@Column({
		type: 'enum',
		enum: AdminRoles,
		nullable: false,
	})
	role!: AdminRoles;

	@Column({
		type: 'boolean',
		default: true,
		name: 'is_active',
	})
	isActive!: boolean;

	@BeforeUpdate()
	@BeforeInsert()
	async encryptPassword() {
		const salt = await bcrypt.genSalt(10);
		this.password = await bcrypt.hash(this.password, salt);
	}

	comparePassword(password: string): Promise<boolean> {
		return bcrypt.compare(password, this.password);
	}
}
