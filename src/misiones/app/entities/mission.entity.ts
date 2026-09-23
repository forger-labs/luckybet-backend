import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { BaseEntity } from '../../../shared/entities/base.entity';
import { User } from '../../../users/app/entities/user.entity';
import { MissionStatus, MissionType } from '../enums';
import type { MissionStep } from './mission-step.entity';
import type { UserMission } from './user-mission.entity';

@Entity('missions')
export class Mission extends BaseEntity {
	@Column({ type: 'varchar', length: 200, nullable: false })
	title!: string;

	@Column({ type: 'text', nullable: true })
	description?: string;

	@Column({ type: 'enum', enum: MissionType, nullable: false })
	type!: MissionType;

	@Column({
		type: 'enum',
		enum: MissionStatus,
		default: MissionStatus.INACTIVE,
	})
	status!: MissionStatus;

	@Column({ type: 'int', nullable: false, name: 'coins_amount' })
	coinsAmount!: number;

	@Column({ type: 'int', nullable: true })
	bonus?: number;

	@Column({ type: 'int', nullable: false, name: 'experience_points' })
	experiencePoints!: number;

	@Column({ type: 'varchar', length: 500, nullable: true, name: 'image_url' })
	imageUrl?: string;

	@Column({ type: 'timestamp', nullable: true, name: 'activated_at' })
	activatedAt?: Date;

	@Column({ type: 'timestamp', nullable: true, name: 'expires_at' })
	expiresAt?: Date;

	// Audit
	@Column({ type: 'int', nullable: true, name: 'created_by' })
	createdById?: number;

	@Column({ type: 'int', nullable: true, name: 'updated_by' })
	updatedById?: number;

	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'created_by' })
	createdBy?: User;

	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'updated_by' })
	updatedBy?: User;

	// Relationships (string refs to avoid circular imports)
	@OneToMany('MissionStep', 'mission')
	steps?: MissionStep[];

	@OneToMany('UserMission', 'mission')
	userMissions?: UserMission[];
}
