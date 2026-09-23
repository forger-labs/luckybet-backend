import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { BaseEntity } from '../../../shared/entities/base.entity';
import { StepType } from '../enums';
import { Mission } from './mission.entity';
import type { UserMissionStep } from './user-mission-step.entity';

export type GamePlayStepConfig = {
	provider?: string;
	gameId?: string;
  minUniqueGames?: number;
  minBet: number;
};

export type StepTargetConfig = GamePlayStepConfig & Record<string, unknown>;

@Entity('mission_steps')
@Index(['missionId', 'stepOrder'], { unique: true })
export class MissionStep extends BaseEntity {
	@Column({ type: 'int', nullable: false, name: 'mission_id' })
	missionId!: number;

	@Column({ type: 'int', nullable: false, name: 'step_order' })
	stepOrder!: number;

	@Column({ type: 'enum', enum: StepType, nullable: false })
	type!: StepType;

	@Column({ type: 'text', nullable: true })
	content?: string;

	@Column({ type: 'jsonb', nullable: true, name: 'target_config' })
	targetConfig?: StepTargetConfig | null;

	// Relationships
	@ManyToOne(() => Mission, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'mission_id' })
	mission!: Mission;

	@OneToMany('UserMissionStep', 'missionStep')
	userSteps?: UserMissionStep[];
}
