import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// import { LevelsEntity } from '../../app/entities/levels.entity';
import { ForDatabaseLevels } from '../../ports/drivers/forDatabaseLevels';

@Injectable()
export class LevelsEntityService implements ForDatabaseLevels {
  // constructor(
  //   @InjectRepository(LevelsEntity)
  //   private readonly levelsRepo: Repository<LevelsEntity>,
  // ) { }

  // createLevel() {

  // }
}
