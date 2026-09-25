import type {
	CreateRoomDto,
	RoomBasic,
	RoomQueryFilter,
	UpdateRoomDto,
} from '../../app/dto/room.schema';

export interface ForManageRooms {
	createRoom(dto: CreateRoomDto): Promise<RoomBasic>;

	getRoom(id: number): Promise<RoomBasic>;

	updateRoom(id: number, dto: UpdateRoomDto): Promise<RoomBasic>;

	toggleRoomActive(id: number, isActive: boolean): Promise<RoomBasic>;

	listRooms(filter: RoomQueryFilter): Promise<{
		rooms: RoomBasic[];
		total: number;
		limit: number;
		skip: number;
	}>;
}
