import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  ILike,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';

import { CreateMissionDto } from '../../app/dto/create-mission.dto';
import type {
  MissionBasic,
  MissionFilter,
  MissionStepBasic,
  MissionWithSteps,
} from '../../app/dto/mission.schema';
import { SortOrder } from '../../app/dto/mission.schema';
import { Mission } from '../../app/entities/mission.entity';
import { MissionStep } from '../../app/entities/mission-step.entity';
import { MissionStatus, MissionType } from '../../app/enums';
import {
  ForDatabaseMissions,
  UpdateMissionData,
} from '../../ports/driver/ForDatabaseMissions';

@Injectable()
export class MissionRepoService implements ForDatabaseMissions {
  constructor(
    @InjectRepository(Mission)
    private readonly missionModel: Repository<Mission>,
  ) {}

  createMission(data: CreateMissionDto): Promise<MissionWithSteps> {
    const { missionSteps, ...missionData } = data;
    return this.missionModel.manager.transaction(async (manager) => {
      const mission = manager.create(Mission, missionData);
      const saved = await manager.save(Mission, mission);

      const steps = await manager.save(
        MissionStep,
        (missionSteps ?? []).map((step) =>
          manager.create(MissionStep, {
            missionId: saved.id,
            stepOrder: step.stepOrder,
            type: step.type,
            content: step.content,
          }),
        ),
      );

      return {
        ...this.toBasic(saved),
        steps: steps.map((s) => this.toStepBasic(s)),
      };
    });
  }

  async findById(id: number): Promise<MissionBasic | null> {
    const mission = await this.missionModel.findOne({ where: { id } });
    return mission ? this.toBasic(mission) : null;
  }

  async findByIdWithSteps(id: number): Promise<MissionWithSteps | null> {
    const mission = await this.missionModel.findOne({
      where: { id },
      relations: {
        steps: true,
      },
      order: { steps: { stepOrder: 'ASC' } },
    });
    if (!mission) return null;

    const basic = this.toBasic(mission);
    return {
      ...basic,
      steps: (mission.steps ?? []).map((s) => this.toStepBasic(s)),
    };
  }

  async getMissions(
    filter?: MissionFilter,
  ): Promise<[MissionWithSteps[], number]> {
    const where: FindOptionsWhere<Mission> = {};

    if (filter?.title) {
      where.title = ILike(`%${filter.title}%`);
    }
    if (filter?.type) {
      where.type = filter.type;
    }
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.roomId !== undefined && filter?.roomId !== null) {
      where.roomId = filter.roomId;
    }
    if (filter?.minCoins !== undefined && filter?.maxCoins !== undefined) {
      where.coinsAmount = Between(filter.minCoins, filter.maxCoins);
    } else if (filter?.minCoins !== undefined) {
      where.coinsAmount = MoreThanOrEqual(filter.minCoins);
    } else if (filter?.maxCoins !== undefined) {
      where.coinsAmount = LessThanOrEqual(filter.maxCoins);
    }
    if (
      filter?.minExperience !== undefined &&
      filter?.maxExperience !== undefined
    ) {
      where.experiencePoints = Between(
        filter.minExperience,
        filter.maxExperience,
      );
    } else if (filter?.minExperience !== undefined) {
      where.experiencePoints = MoreThanOrEqual(filter.minExperience);
    } else if (filter?.maxExperience !== undefined) {
      where.experiencePoints = LessThanOrEqual(filter.maxExperience);
    }

    const orderDirection = filter?.orderDirection ?? SortOrder.DESC;

    const [missions, count] = await this.missionModel.findAndCount({
      where,
      skip: filter?.skip ?? 0,
      take: filter?.take ?? 50,
      order: { created_at: orderDirection },
      select: {
        roomId: true,
        coinsAmount: true,
        description: true,
        experiencePoints: true,
        expiresAt: true,
        created_at: true,
        id: true,
        imageUrl: true,
        title: true,
        status: true,
        type: true,
        activatedAt: true,
        steps: {
          content: true,
          id: true,
          stepOrder: true,
          type: true,
        },
        room: {
          bonus: true,
          id: true,
          name: true,
        },
        createdById: true,
        createdBy: {
          username: true,
          id: true,
        },
      },
      relations: {
        steps: true,
        room: true,
      },
    });
    return [
      missions.map((m) => ({
        ...this.toBasic(m),
        steps: (m.steps ?? []).map((s) => this.toStepBasic(s)),
      })),
      count,
    ];
  }

  async updateMission(
    id: number,
    data: UpdateMissionData,
  ): Promise<MissionBasic | null> {
    const mission = await this.missionModel.findOne({ where: { id } });
    if (!mission) return null;

    Object.assign(mission, data);
    const saved = await this.missionModel.save(mission);
    return this.toBasic(saved);
  }

  async activateMission(id: number): Promise<MissionBasic> {
    const mission = await this.missionModel.manager.transaction(
      async (manager) => {
        const mission = await manager.findOne(Mission, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!mission) {
          throw new NotFoundException('Mission not found');
        }

        const now = new Date();
        mission.status = MissionStatus.ACTIVE;
        mission.activatedAt = now;

        if (mission.type === MissionType.WEEKLY) {
          mission.expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        } else if (mission.type === MissionType.DAILY) {
          mission.expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        }

        const saved = await manager.save(Mission, mission);
        return saved;
      },
    );
    return this.toBasic(mission);
  }

  async findActiveMissions(): Promise<MissionBasic[]> {
    const missions = await this.missionModel.find({
      where: { status: MissionStatus.ACTIVE },
    });
    return missions.map((m) => this.toBasic(m));
  }

  private toBasic(mission: Mission): MissionBasic {
    return {
      id: mission.id,
      title: mission.title,
      description: mission.description,
      type: mission.type,
      status: mission.status,
      coinsAmount: mission.coinsAmount,
      roomId: mission.roomId,
      experiencePoints: mission.experiencePoints,
      imageUrl: mission.imageUrl,
      activatedAt: mission.activatedAt,
      expiresAt: mission.expiresAt,
      room: {
        bonus: mission.room?.bonus,
        id: mission.room?.id,
        name: mission.room?.name,
      },
    };
  }

  private toStepBasic(step: MissionStep): MissionStepBasic {
    return {
      id: step.id,
      missionId: step.missionId,
      stepOrder: step.stepOrder,
      type: step.type,
      content: step.content,
      targetConfig: step.targetConfig ?? null,
    };
  }
}
