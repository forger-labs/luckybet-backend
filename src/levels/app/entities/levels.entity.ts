import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { Player } from '../../../players/app/entities/player.entity';
import { BonusRoom } from '../../../rooms/app/entities/bonus-room.entity';
import { BaseEntity } from '../../../shared/entities/base.entity';

@Entity('levels')
export class LevelsEntity extends BaseEntity {
	@Column({
		type: 'varchar',
		nullable: false,
		length: 100,
	})
	name: string;

	@Column({
		type: 'varchar',
		nullable: false,
		length: 500,
	})
	image: string;

	@Column({
		type: 'int',
		name: 'min_experience',
		nullable: false,
	})
	minExperience: number;

	@Column({
		type: 'int',
		nullable: false,
	})
	coins: number;

	@Column({
		type: 'int',
		nullable: true,
		name: 'room_id',
	})
	roomId?: number | null;

	@ManyToOne(() => BonusRoom, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'room_id' })
	room?: BonusRoom | null;

	@OneToMany(
		() => Player,
		player => player.level,
	)
	players: Player[];
}
