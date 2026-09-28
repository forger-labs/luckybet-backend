import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsOrder, FindOptionsWhere, Repository } from 'typeorm';

import {
	type MissionRewardBasic,
	RewardFilter,
	RewardSortField,
	SortOrder,
} from '../../app/dto/reward.schema';
import { MissionReward } from '../../app/entities/mission-reward.entity';
import { RewardStatus } from '../../app/enums';
import type {
	CreateMissionRewardInput,
	ForDatabaseMissionRewards,
} from '../../ports/driver/ForDatabaseMissionRewards';

@Injectable()
export class MissionRewardRepoService implements ForDatabaseMissionRewards {
	constructor(
		@InjectRepository(MissionReward)
		private readonly rewardModel: Repository<MissionReward>,
	) {}

	async createReward(data: CreateMissionRewardInput): Promise<MissionRewardBasic> {
		const existing = await this.rewardModel.findOne({
			where: { userMissionId: data.userMissionId },
		});
		if (existing) {
			return this.toBasic(existing);
		}

		const entity = this.rewardModel.create({
			userMissionId: data.userMissionId,
			playerId: data.playerId,
			coinsAmount: data.coinsAmount,
			roomId: data.roomId,
			experiencePoints: data.experiencePoints,
			status: RewardStatus.PENDING,
		});

		const saved = await this.rewardModel.save(entity);
		return this.toBasic(saved);
	}

	async findByUserMissionId(userMissionId: number): Promise<MissionRewardBasic | null> {
		const reward = await this.rewardModel.findOne({
			where: { userMissionId },
			relations: { userMission: { mission: true } },
		});
		if (!reward) return null;

		const basic = this.toBasic(reward);
		return {
			...basic,
			missionTitle: reward.userMission?.mission?.title,
		};
	}

	async findById(id: number): Promise<MissionRewardBasic | null> {
		const reward = await this.rewardModel.findOne({
			where: { id },
			relations: { userMission: { mission: true } },
		});
		return reward ? this.toBasic(reward) : null;
	}

	async getRewards(
		filter?: RewardFilter,
		overridePlayerId?: number,
	): Promise<[MissionRewardBasic[], number]> {
		const where: FindOptionsWhere<MissionReward> = {};

		if (overridePlayerId !== undefined) {
			where.playerId = overridePlayerId;
		} else if (filter?.playerId !== undefined && filter?.playerId !== null) {
			where.playerId = filter.playerId;
		}

		if (filter?.status) {
			where.status = filter.status;
		}
		if (filter?.userMissionId !== undefined && filter?.userMissionId !== null) {
			where.userMissionId = filter.userMissionId;
		}

		const orderField = filter?.orderBy ?? RewardSortField.CREATED_AT;
		const orderDir = filter?.orderDirection ?? SortOrder.DESC;
		const order: FindOptionsOrder<MissionReward> = {
			[orderField]: orderDir,
		};

		const [rewards, count] = await this.rewardModel.findAndCount({
			where,
			relations: { userMission: { mission: true, player: true }, resolvedByAdmin: true },
			order,
			take: filter?.take ?? 50,
			skip: filter?.skip ?? 0,
		});

		return [rewards.map(r => this.toBasic(r)), count];
	}

	async acquireProcessingLock(
		userMissionId: number,
		allowedStatuses: RewardStatus[] = [RewardStatus.PENDING],
	): Promise<MissionRewardBasic | null> {
		const result = await this.rewardModel
			.createQueryBuilder()
			.update(MissionReward)
			.set({ status: RewardStatus.PROCESSING, errorMessage: null })
			.where('user_mission_id = :userMissionId', { userMissionId })
			.andWhere('status IN (:...allowedStatuses)', { allowedStatuses })
			.returning('*')
			.execute();

		if (!result.raw || result.raw.length === 0) {
			return null;
		}

		const updatedEntity = result.raw[0] as MissionReward;
		return this.toBasic(updatedEntity);
	}

	async updateStatus(
		id: number,
		status: RewardStatus,
		options?: {
			externalOperationId?: string | null;
			errorMessage?: string | null;
			resolvedByAdminId?: number | null;
			claimedAt?: Date | null;
		},
	): Promise<MissionRewardBasic> {
		await this.rewardModel.update(id, {
			status,
			externalOperationId: options?.externalOperationId,
			errorMessage: options?.errorMessage,
			resolvedByAdminId: options?.resolvedByAdminId,
			claimedAt: options?.claimedAt,
		});

		const updated = await this.rewardModel.findOne({ where: { id } });
		// biome-ignore lint/style/noNonNullAssertion: verified updated
		return this.toBasic(updated!);
	}

	private toBasic(reward: MissionReward): MissionRewardBasic {
		return {
			id: reward.id,
			userMissionId: reward.userMissionId,
			playerId: reward.playerId,
			coinsAmount: reward.coinsAmount,
			roomId: reward.roomId,
			experiencePoints: reward.experiencePoints,
			status: reward.status,
			externalOperationId: reward.externalOperationId,
			errorMessage: reward.errorMessage,
			resolvedByAdminId: reward.resolvedByAdminId,
			claimedAt: reward.claimedAt ? reward.claimedAt.toISOString() : null,
			createdAt: reward.created_at ? reward.created_at.toISOString() : undefined,
			updatedAt: reward.updated_at ? reward.updated_at.toISOString() : undefined,
		};
	}
}
