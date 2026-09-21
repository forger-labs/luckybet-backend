import { Column, Entity, OneToMany } from 'typeorm';

import { Player } from '../../../players/app/entities/player.entity';
import { BaseEntity } from '../../../shared/entities/base.entity';
import { BonusIntern } from '../../../types/bonus';

@Entity('levels')
export default class LevelsEntity extends BaseEntity {
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
    type: 'enum',
    nullable: true,
    enum: BonusIntern,
  })
  bonus: BonusIntern;

  @OneToMany(() => Player, (player) => player.level)
  players: Player[];
}
