import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Equal, FindOptionsWhere, ILike, Repository } from 'typeorm';

import type { RoomBasic, RoomQueryFilter } from '../../app/dto/room.schema';
import { BonusRoom } from '../../app/entities/bonus-room.entity';
import type {
  CreateRoomInput,
  ForDatabaseRooms,
  UpdateRoomInput,
} from '../../ports/driver/ForDatabaseRooms';

@Injectable()
export class BonusRoomRepoService implements ForDatabaseRooms {
  constructor(
    @InjectRepository(BonusRoom)
    private readonly roomModel: Repository<BonusRoom>,
  ) {}

  async createRoom(data: CreateRoomInput): Promise<RoomBasic> {
    const entity = this.roomModel.create(data);
    const saved = await this.roomModel.save(entity);
    return this.toBasic(saved);
  }

  async findById(id: number): Promise<RoomBasic | null> {
    const found = await this.roomModel.findOne({ where: { id } });
    return found ? this.toBasic(found) : null;
  }

  async findByName(name: string): Promise<RoomBasic | null> {
    const found = await this.roomModel.findOne({ where: { name } });
    return found ? this.toBasic(found) : null;
  }

  async updateRoom(
    id: number,
    data: UpdateRoomInput,
  ): Promise<RoomBasic | null> {
    await this.roomModel.update(id, data);
    const updated = await this.roomModel.findOne({ where: { id } });
    return updated ? this.toBasic(updated) : null;
  }

  async getRooms(filter: RoomQueryFilter): Promise<[RoomBasic[], number]> {
    const where: FindOptionsWhere<BonusRoom> = {};

    if (filter.name) {
      where.name = ILike(`%${filter.name}%`);
    }
    if (filter.bonus !== undefined) {
      where.bonus = filter.bonus;
    }
    if (filter.isActive !== undefined && filter.isActive !== null) {
      // const isActive =
      //   filter.isActive === 'true'
      //     ? true
      //     : filter.isActive === 'false'
      //       ? false
      //       : '';

      // if (typeof isActive !== 'string') {
        where.isActive = filter.isActive;
      // }
    }

    const [list, count] = await this.roomModel.findAndCount({
      where,
      take: filter.take ?? 50,
      skip: filter.skip ?? 0,
      order: { created_at: 'DESC' },
    });

    return [list.map((r) => this.toBasic(r)), count];
  }

  private toBasic(room: BonusRoom): RoomBasic {
    return {
      id: room.id,
      name: room.name,
      bonus: room.bonus,
      isActive: room.isActive,
      createdAt: room.created_at ? room.created_at.toISOString() : undefined,
      updatedAt: room.updated_at ? room.updated_at.toISOString() : undefined,
    };
  }
}
