import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { BonusRoomRepoService } from './adapters/driven/BonusRoomRepo.service';
import { RoomsController } from './adapters/driver/rooms.controller';
import { FOR_DATABASE_ROOMS, ROOMS_CORE_PROVIDER } from './app/constants';
import { BonusRoom } from './app/entities/bonus-room.entity';
import { RoomsCore } from './app/roomsCore';
import type { ForDatabaseRooms } from './ports/driver/ForDatabaseRooms';

@Module({
	imports: [TypeOrmModule.forFeature([BonusRoom]), AuthModule],
	controllers: [RoomsController],
	providers: [
		{
			provide: FOR_DATABASE_ROOMS,
			useClass: BonusRoomRepoService,
		},
		{
			provide: ROOMS_CORE_PROVIDER,
			useFactory: (roomRepo: ForDatabaseRooms) => new RoomsCore(roomRepo),
			inject: [FOR_DATABASE_ROOMS],
		},
	],
	exports: [ROOMS_CORE_PROVIDER, FOR_DATABASE_ROOMS],
})
export class RoomsModule {}
