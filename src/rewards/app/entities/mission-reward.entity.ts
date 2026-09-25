import { Column, Entity, Index, JoinColumn, ManyToOne, OneToOne } from 'typeorm';

import { Mission } from '../../../misiones/app/entities/mission.entity';
import { UserMission } from '../../../misiones/app/entities/user-mission.entity';
import { BonusRoom } from '../../../rooms/app/entities/bonus-room.entity';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { User } from '../../../users/app/entities/user.entity';
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

	@Column({ type: 'int', nullable: true, name: 'room_id' })
	roomId?: number | null;

	@ManyToOne(() => BonusRoom, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'room_id' })
	room?: BonusRoom | null;

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

	@Column({ type: 'int', nullable: true, name: 'resolved_by_admin_id' })
	resolvedByAdminId?: number | null;

	@Column({ type: 'timestamp', nullable: true, name: 'claimed_at' })
	claimedAt?: Date | null;

	// Relationships
	@OneToOne(() => UserMission, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'user_mission_id' })
	userMission!: UserMission;

	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'resolved_by_admin_id' })
	resolvedByAdmin?: User | null;
}
