import type { BonusIntern } from '../../../types/bonus';
import type { RoomBasic, RoomQueryFilter } from '../../app/dto/room.schema';

export type CreateRoomInput = {
	name: string;
	bonus: BonusIntern;
	isActive?: boolean;
};

export type UpdateRoomInput = Partial<CreateRoomInput>;

export interface ForDatabaseRooms {
	createRoom(data: CreateRoomInput): Promise<RoomBasic>;

	findById(id: number): Promise<RoomBasic | null>;

	findByName(name: string): Promise<RoomBasic | null>;

	updateRoom(id: number, data: UpdateRoomInput): Promise<RoomBasic | null>;

	getRooms(filter: RoomQueryFilter): Promise<[RoomBasic[], number]>;

	findActiveRooms(): Promise<RoomBasic[]>;
}
