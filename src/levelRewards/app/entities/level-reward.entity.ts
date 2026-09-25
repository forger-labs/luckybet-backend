import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { LevelsEntity } from '../../../levels/app/entities/levels.entity';
import { Player } from '../../../players/app/entities/player.entity';
import { RewardStatus } from '../../../rewards/app/enums';
import { BonusRoom } from '../../../rooms/app/entities/bonus-room.entity';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { User } from '../../../users/app/entities/user.entity';

@Entity('level_rewards')
@Unique('UQ_level_rewards_player_level', ['playerId', 'levelId'])
export class LevelReward extends BaseEntity {
	@Column({ type: 'int', name: 'player_id' })
	@Index()
	playerId!: number;

	@ManyToOne(() => Player, { onDelete: 'RESTRICT', nullable: false })
	@JoinColumn({ name: 'player_id' })
	player?: Player;

	@Column({ type: 'int', name: 'level_id' })
	@Index()
	levelId!: number;

	@ManyToOne(() => LevelsEntity, { onDelete: 'RESTRICT', nullable: false })
	@JoinColumn({ name: 'level_id' })
	level?: LevelsEntity;

	@Column({ type: 'int', name: 'coins_amount', default: 0 })
	coinsAmount!: number;

	@Column({ type: 'int', name: 'room_id', nullable: true })
	roomId?: number | null;

	@ManyToOne(() => BonusRoom, { onDelete: 'SET NULL', nullable: true })
	@JoinColumn({ name: 'room_id' })
	room?: BonusRoom | null;

	@Column({
		type: 'enum',
		enum: RewardStatus,
		default: RewardStatus.PENDING,
	})
	@Index()
	status!: RewardStatus;

	@Column({ type: 'varchar', length: 150, nullable: true, name: 'external_operation_id' })
	externalOperationId?: string | null;

	@Column({ type: 'text', nullable: true, name: 'error_message' })
	errorMessage?: string | null;

	@Column({ type: 'int', nullable: true, name: 'resolved_by_admin_id' })
	resolvedByAdminId?: number | null;

	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'resolved_by_admin_id' })
	resolvedByAdmin?: User | null;

	@Column({ type: 'timestamp with time zone', nullable: true, name: 'claimed_at' })
	claimedAt?: Date | null;
}
