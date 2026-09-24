import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { MissionChest } from '../../../chests/app/entities/mission-chest.entity';
import { RewardStatus } from '../../../rewards/app/enums';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { User } from '../../../users/app/entities/user.entity';

@Entity('user_mission_chests')
@Index(['playerId', 'chestId', 'periodKey'], { unique: true })
export class UserMissionChest extends BaseEntity {
	@Column({ type: 'int', nullable: false, name: 'player_id' })
	playerId!: number;

	@Column({ type: 'int', nullable: false, name: 'chest_id' })
	chestId!: number;

	@Column({ type: 'varchar', length: 50, nullable: false, name: 'period_key' })
	periodKey!: string;

	@Column({ type: 'int', nullable: false, default: 0, name: 'completed_missions_count' })
	completedMissionsCount!: number;

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
	@ManyToOne(() => MissionChest, { onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'chest_id' })
	chest!: MissionChest;

	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'resolved_by_admin_id' })
	resolvedByAdmin?: User | null;
}
