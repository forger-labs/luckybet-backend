import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from '@nestjs/common';

import type { ForManageRooms } from '../ports/driven/ForManageRooms';
import type { ForDatabaseRooms } from '../ports/driver/ForDatabaseRooms';
import { FOR_DATABASE_ROOMS } from './constants';
import type {
	CreateRoomDto,
	RoomBasic,
	RoomQueryFilter,
	UpdateRoomDto,
} from './dto/room.schema';

@Injectable()
export class RoomsCore implements ForManageRooms {
	constructor(
		@Inject(FOR_DATABASE_ROOMS)
		private readonly roomRepo: ForDatabaseRooms,
	) {}

	async createRoom(dto: CreateRoomDto): Promise<RoomBasic> {
		const existing = await this.roomRepo.findByName(dto.name.trim());
		if (existing) {
			throw new ConflictException(`Ya existe una sala con el nombre [${dto.name}]`);
		}

		return this.roomRepo.createRoom({
			name: dto.name.trim(),
			bonus: dto.bonus,
			isActive: dto.isActive,
		});
	}

	async getRoom(id: number): Promise<RoomBasic> {
		const room = await this.roomRepo.findById(id);
		if (!room) {
			throw new NotFoundException(`Sala con ID ${id} no encontrada`);
		}
		return room;
	}

	async updateRoom(id: number, dto: UpdateRoomDto): Promise<RoomBasic> {
		const existing = await this.roomRepo.findById(id);
		if (!existing) {
			throw new NotFoundException(`Sala con ID ${id} no encontrada`);
		}

		if (dto.name && dto.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
			const duplicated = await this.roomRepo.findByName(dto.name.trim());
			if (duplicated) {
				throw new ConflictException(`Ya existe una sala con el nombre [${dto.name}]`);
			}
		}

		const updated = await this.roomRepo.updateRoom(id, {
			...dto,
			name: dto.name ? dto.name.trim() : undefined,
		});

		if (!updated) {
			throw new NotFoundException(`Sala con ID ${id} no encontrada`);
		}

		return updated;
	}

	async toggleRoomActive(id: number, isActive: boolean): Promise<RoomBasic> {
		const updated = await this.roomRepo.updateRoom(id, { isActive });
		if (!updated) {
			throw new NotFoundException(`Sala con ID ${id} no encontrada`);
		}
		return updated;
	}

	async listRooms(filter: RoomQueryFilter): Promise<{
		rooms: RoomBasic[];
		total: number;
		limit: number;
		skip: number;
	}> {
		const [rooms, total] = await this.roomRepo.getRooms(filter);
		return {
			rooms,
			total,
			limit: filter.take ?? 50,
			skip: filter.skip ?? 0,
		};
	}

	getActiveRooms(): Promise<RoomBasic[]> {
		return this.roomRepo.findActiveRooms();
	}
}
