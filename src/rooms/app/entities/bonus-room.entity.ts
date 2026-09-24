import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../shared/entities/base.entity';
import { BonusIntern } from '../../../types/bonus';

@Entity('bonus_rooms')
@Index(['name'], { unique: true })
@Index(['bonus', 'isActive'])
export class BonusRoom extends BaseEntity {
	@Column({ type: 'varchar', length: 100, nullable: false, unique: true })
	name!: string;

	@Column({
		type: 'enum',
		enum: BonusIntern,
		default: BonusIntern.Zero,
		nullable: false,
	})
	bonus!: BonusIntern;

	@Column({ type: 'boolean', default: true, name: 'is_active' })
	isActive!: boolean;
}
