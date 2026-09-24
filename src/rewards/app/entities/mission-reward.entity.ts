import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';

import { Mission } from '../../../misiones/app/entities/mission.entity';
import { UserMission } from '../../../misiones/app/entities/user-mission.entity';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { RewardStatus } from '../enums';

@Entity('mission_rewards')
@Index(['playerId', 'status'])
export class MissionReward extends BaseEntity {
	@Column({ type: 'int', unique: true, nullable: false, name: 'user_mission_id' })
	userMissionId!: number;

	@Column({ type: 'int', nullable: false, name: 'player_id' })
	playerId!: number;

	@Column({ type: 'int', nullable: false, name: 'coins_amount', default: 0 })
	coinsAmount!: number;

	@Column({ type: 'int', nullable: false, name: 'experience_points', default: 0 })
	experiencePoints!: number;

	@Column({
		type: 'enum',
		enum: RewardStatus,
		default: RewardStatus.PENDING,
		nullable: false,
	})
	status!: RewardStatus;

	@Column({ type: 'varchar', length: 100, nullable: true, name: 'external_operation_id' })
	externalOperationId?: string | null;

	@Column({ type: 'text', nullable: true, name: 'error_message' })
	errorMessage?: string | null;

	@Column({ type: 'timestamp', nullable: true, name: 'claimed_at' })
	claimedAt?: Date | null;

	// Relationships
	@OneToOne(() => UserMission, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_mission_id' })
	userMission!: UserMission;
}
