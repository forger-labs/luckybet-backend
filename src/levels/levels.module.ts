import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlayersModule } from '../players/players.module';
import { LevelsController } from './adapters/drivers/levels.controller';
import LevelsEntity from './app/entities/levels.entity';

@Module({
	imports: [PlayersModule, TypeOrmModule.forFeature([LevelsEntity])],
	controllers: [LevelsController],
})
export class LevelsModule {}
