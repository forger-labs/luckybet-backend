import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { STORAGE_SERVICE } from '../shared/storage/storage.constants';
import { StorageModule } from '../shared/storage/storage.module';
import type { StorageService } from '../shared/storage/storage.port';
import { MissionChestRepoService } from './adapters/driven/MissionChestRepo.service';
import { ChestsController } from './adapters/driver/chests.controller';
import { ChestsCore } from './app/chestsCore';
import { CHESTS_CORE_PROVIDER, FOR_DATABASE_CHESTS } from './app/constants';
import { MissionChest } from './app/entities/mission-chest.entity';
import type { ForDatabaseChests } from './ports/driver/ForDatabaseChests';

@Module({
  imports: [
    TypeOrmModule.forFeature([MissionChest]),
    AuthModule,
    StorageModule,
  ],
  controllers: [ChestsController],
  providers: [
    {
      provide: FOR_DATABASE_CHESTS,
      useClass: MissionChestRepoService,
    },
    {
      provide: CHESTS_CORE_PROVIDER,
      useFactory: (chestRepo: ForDatabaseChests, storage: StorageService) =>
        new ChestsCore(chestRepo, storage),
      inject: [FOR_DATABASE_CHESTS, STORAGE_SERVICE],
    },
  ],
  exports: [CHESTS_CORE_PROVIDER, FOR_DATABASE_CHESTS],
})
export class ChestsModule {}
