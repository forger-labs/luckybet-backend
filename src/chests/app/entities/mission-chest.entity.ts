import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BonusRoom } from '../../../rooms/app/entities/bonus-room.entity';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { ChestPeriodType } from '../enums';

@Entity('mission_chests')
@Index(['periodType', 'isActive'])
export class MissionChest extends BaseEntity {
	@Column({ type: 'varchar', length: 200, nullable: false })
	title!: string;

	@Column({ type: 'text', nullable: true })
	description?: string;

	@Column({
		type: 'enum',
		enum: ChestPeriodType,
		default: ChestPeriodType.WEEKLY,
		nullable: false,
		name: 'period_type',
	})
	periodType!: ChestPeriodType;

	@Column({ type: 'int', nullable: false, default: 5, name: 'required_missions' })
	requiredMissions!: number;

	@Column({ type: 'int', nullable: false, default: 0, name: 'coins_amount' })
	coinsAmount!: number;

	@Column({ type: 'int', nullable: true, name: 'room_id' })
	roomId?: number | null;

	@ManyToOne(() => BonusRoom, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'room_id' })
	room?: BonusRoom | null;

	@Column({ type: 'int', nullable: false, default: 0, name: 'experience_points' })
	experiencePoints!: number;

	@Column({ type: 'varchar', length: 500, nullable: true, name: 'image_url' })
	imageUrl?: string | null;

	@Column({ type: 'boolean', default: true, name: 'is_active' })
	isActive!: boolean;
}
