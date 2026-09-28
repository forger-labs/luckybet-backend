import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	Between,
	FindOptionsWhere,
	LessThanOrEqual,
	MoreThanOrEqual,
	Repository,
} from 'typeorm';

import type {
	UserMissionBasic,
	UserMissionFilter,
	UserMissionWithSteps,
} from '../../app/dto/mission.schema';
import { SortOrder } from '../../app/dto/mission.schema';
import { Mission } from '../../app/entities/mission.entity';
import { UserMission } from '../../app/entities/user-mission.entity';
import { MissionType, UserMissionStatus } from '../../app/enums';
import type {
	ForDatabaseUserMissions,
	PlayerMissionsQueueFiltersDB,
} from '../../ports/driver/ForDatabaseUserMissions';

@Injectable()
export class UserMissionRepoService implements ForDatabaseUserMissions {
	constructor(
		@InjectRepository(UserMission)
		private readonly userMissionModel: Repository<UserMission>,
	) {}

	async createUserMission(data: {
		playerId: number;
		missionId: number;
	}): Promise<UserMissionBasic> {
		const um = this.userMissionModel.create({
			playerId: data.playerId,
			missionId: data.missionId,
		});
		const saved = await this.userMissionModel.save(um);
		return this.toBasic(saved);
	}

	async findById(id: number): Promise<UserMissionBasic | null> {
		const um = await this.userMissionModel.findOne({ where: { id } });
		return um ? this.toBasic(um) : null;
	}

	async findByPlayerAndMission(
		playerId: number,
		missionId: number,
	): Promise<UserMissionBasic | null> {
		const um = await this.userMissionModel.findOne({
			where: { playerId, missionId },
		});
		return um ? this.toBasic(um) : null;
	}

	async findByPlayer(
		playerId: number,
		filter?: UserMissionFilter,
	): Promise<[UserMissionBasic[], number]> {
		const where: FindOptionsWhere<UserMission> = { playerId };

		if (filter?.status) {
			where.status = filter.status as UserMissionStatus;
		}
		if (filter?.missionId !== undefined && filter?.missionId !== null) {
			where.missionId = filter.missionId;
		}

		const orderDirection = filter?.orderDirection ?? SortOrder.DESC;

		const [list, count] = await this.userMissionModel.findAndCount({
			where,
			skip: filter?.skip ?? 0,
			take: filter?.take ?? 50,
			order: { created_at: orderDirection },
		});
		return [list.map(um => this.toBasic(um)), count];
	}

	async findByIdWithSteps(id: number): Promise<UserMissionWithSteps | null> {
		const um = await this.userMissionModel.findOne({
			where: { id },
			relations: { steps: true },
		});
		if (!um) return null;

		const basic = this.toBasic(um);
		return {
			...basic,
			steps: (um.steps ?? []).map(s => ({
				id: s.id,
				userMissionId: s.userMissionId,
				missionStepId: s.missionStepId,
				status: s.status,
				submissionText: s.submissionText,
				submissionImageUrl: s.submissionImageUrl,
				reviewedById: s.reviewedById,
				reviewedAt: s.reviewedAt,
				reviewerNotes: s.reviewerNotes,
			})),
		};
	}

	findUserMissionsWithContext(
		filters: PlayerMissionsQueueFiltersDB,
		take: number,
		skip: number,
	): Promise<[UserMission[], number]> {
		const where = this.buildUserMissionQueueWhere(filters);
		return this.userMissionModel.findAndCount({
			where,
			relations: { player: true, mission: true, steps: true },
			order: { created_at: 'DESC' },
			take,
			skip,
		});
	}

	private buildUserMissionQueueWhere(
		params: PlayerMissionsQueueFiltersDB,
	): FindOptionsWhere<UserMission> {
		const where: FindOptionsWhere<UserMission> = {};

		if (params.playerId !== undefined) {
			where.playerId = params.playerId;
		}
		if (params.umStatus) {
			where.status = params.umStatus;
		}

		const missionWhere: FindOptionsWhere<Mission> = {};
		if (params.minExperience !== undefined) {
			missionWhere.experiencePoints = MoreThanOrEqual(params.minExperience);
		}
		if (params.maxExperience !== undefined) {
			missionWhere.experiencePoints = LessThanOrEqual(params.maxExperience);
		}
		if (params.minCoinsAmount !== undefined) {
			missionWhere.coinsAmount = MoreThanOrEqual(params.minCoinsAmount);
		}
		if (params.maxCoinsAmount !== undefined) {
			missionWhere.coinsAmount = LessThanOrEqual(params.maxCoinsAmount);
		}
		if (params.type) {
			const resolved = this.resolveMissionType(params.type);
			if (resolved) {
				missionWhere.type = resolved;
			}
		}

		if (Object.keys(missionWhere).length > 0) {
			where.mission = missionWhere;
		}
		return where;
	}

	private resolveMissionType(type?: string): MissionType | undefined {
		if (type === undefined || type === null) return;
		return Object.values(MissionType).includes(type as MissionType)
			? (type as MissionType)
			: undefined;
	}

	async updateCurrentStep(id: number, step: number): Promise<UserMissionBasic> {
		await this.userMissionModel.update(id, { currentStep: step });
		const updated = await this.userMissionModel.findOne({ where: { id } });
		// biome-ignore lint/style/noNonNullAssertion: we verify mission in core
		return this.toBasic(updated!);
	}

	async updateStatus(id: number, status: UserMissionStatus): Promise<UserMissionBasic> {
		await this.userMissionModel.update(id, {
			status,
			completedAt: status === UserMissionStatus.COMPLETED ? new Date() : undefined,
		});
		const updated = await this.userMissionModel.findOne({ where: { id } });
		// biome-ignore lint/style/noNonNullAssertion: we verify mission in core
		return this.toBasic(updated!);
	}

	countCompletedBetween(
		playerId: number,
		startDate: Date,
		endDate: Date,
	): Promise<number> {
		return this.userMissionModel.count({
			where: {
				playerId,
				status: UserMissionStatus.COMPLETED,
				completedAt: Between(startDate, endDate),
			},
		});
	}

	private toBasic(um: UserMission): UserMissionBasic {
		return {
			id: um.id,
			playerId: um.playerId,
			missionId: um.missionId,
			status: um.status,
			currentStep: um.currentStep,
			startedAt: um.startedAt,
			completedAt: um.completedAt,
		};
	}
}
