import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { Player } from '../../../players/app/entities/player.entity';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { UserMissionStatus } from '../enums';
import { Mission } from './mission.entity';
import type { UserMissionStep } from './user-mission-step.entity';

// TODO: delete base entity because started_at and created_at have the same responsability
@Entity('user_missions')
export class UserMission extends BaseEntity {
	@Column({ type: 'int', nullable: false, name: 'player_id' })
	playerId!: number;

	@Column({ type: 'int', nullable: false, name: 'mission_id' })
	missionId!: number;

	@Column({
		type: 'enum',
		enum: UserMissionStatus,
		default: UserMissionStatus.IN_PROGRESS,
	})
	status!: UserMissionStatus;

	@Column({ type: 'int', default: 0, name: 'current_step' })
	currentStep!: number;

	@Column({ type: 'timestamp', default: () => 'NOW()', name: 'started_at' })
	startedAt!: Date;

	@Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
	completedAt?: Date;

	// Relationships
	@ManyToOne(() => Player)
	@JoinColumn({ name: 'player_id' })
	player!: Player;

	@ManyToOne(() => Mission)
	@JoinColumn({ name: 'mission_id' })
	mission!: Mission;

	@OneToMany('UserMissionStep', 'userMission')
	steps?: UserMissionStep[];
}
