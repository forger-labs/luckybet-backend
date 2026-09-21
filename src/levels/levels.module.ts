import { Module } from '@nestjs/common';

import { LevelsController } from './adapters/drivers/levels.controller';

@Module({
  controllers: [LevelsController],
})
export class LevelsModule {}
