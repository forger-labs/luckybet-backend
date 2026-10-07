import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../../shared/entities/base.entity';
import { User } from '../../../users/app/entities/user.entity';
import { StepStatus } from '../enums';
import { MissionStep } from './mission-step.entity';
import { UserMission } from './user-mission.entity';

@Entity('user_mission_steps')
@Index(['userMissionId', 'missionStepId'], { unique: true })
export class UserMissionStep extends BaseEntity {
	@Column({ type: 'int', nullable: false, name: 'user_mission_id' })
	userMissionId!: number;

	@Column({ type: 'int', nullable: false, name: 'mission_step_id' })
	missionStepId!: number;

	@Column({
		type: 'enum',
		enum: StepStatus,
		default: StepStatus.PENDING,
	})
	status!: StepStatus;

	@Column({ type: 'text', nullable: true, name: 'submission_text' })
	submissionText?: string;

	@Column({
		type: 'varchar',
		length: 500,
		nullable: true,
		name: 'submission_image_url',
	})
	submissionImageUrl?: string;

	@Column({ type: 'int', nullable: true, name: 'reviewed_by' })
	reviewedById?: number;

	@Column({ type: 'timestamp', nullable: true, name: 'reviewed_at' })
	reviewedAt?: Date;

	@Column({ type: 'text', nullable: true, name: 'reviewer_notes' })
	reviewerNotes?: string;

	// Relationships
	@ManyToOne(() => UserMission, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_mission_id' })
	userMission!: UserMission;

	@ManyToOne(() => MissionStep, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'mission_step_id' })
	missionStep!: MissionStep;

	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'reviewed_by' })
	reviewedBy?: User;
}
