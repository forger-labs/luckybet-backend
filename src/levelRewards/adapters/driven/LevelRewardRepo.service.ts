import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsOrder, FindOptionsWhere, Repository } from 'typeorm';

import { RewardStatus } from '../../../rewards/app/enums';
import {
	type LevelRewardBasic,
	LevelRewardFilter,
	LevelRewardSortField,
	SortOrder,
} from '../../app/dto/level-reward.schema';
import { LevelReward } from '../../app/entities/level-reward.entity';
import type {
	CreateLevelRewardInput,
	ForDatabaseLevelRewards,
} from '../../ports/driver/ForDatabaseLevelRewards';

@Injectable()
export class LevelRewardRepoService implements ForDatabaseLevelRewards {
	constructor(
		@InjectRepository(LevelReward)
		private readonly rewardModel: Repository<LevelReward>,
	) {}

	async createReward(data: CreateLevelRewardInput): Promise<LevelRewardBasic> {
		const entity = this.rewardModel.create({
			playerId: data.playerId,
			levelId: data.levelId,
			coinsAmount: data.coinsAmount,
			roomId: data.roomId,
			status: data.status ?? RewardStatus.PENDING,
		});
		const saved = await this.rewardModel.save(entity);
		return this.toBasic(saved);
	}

	async findByPlayerAndLevel(
		playerId: number,
		levelId: number,
	): Promise<LevelRewardBasic | null> {
		const found = await this.rewardModel.findOne({
			where: { playerId, levelId },
		});
		return found ? this.toBasic(found) : null;
	}

	async findById(id: number): Promise<LevelRewardBasic | null> {
		const found = await this.rewardModel.findOne({ where: { id } });
		return found ? this.toBasic(found) : null;
	}

	async acquireClaimLock(data: CreateLevelRewardInput): Promise<LevelRewardBasic | null> {
		try {
			const entity = this.rewardModel.create({
				playerId: data.playerId,
				levelId: data.levelId,
				coinsAmount: data.coinsAmount,
				roomId: data.roomId,
				status: RewardStatus.PROCESSING,
			});
			const saved = await this.rewardModel.save(entity);
			return this.toBasic(saved);
		} catch {
			return null;
		}
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
	): Promise<LevelRewardBasic> {
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

	async getPlayerRewards(
		playerId: number,
		filter: LevelRewardFilter,
	): Promise<[LevelRewardBasic[], number]> {
		const where: FindOptionsWhere<LevelReward> = { playerId };

		if (filter.levelId) {
			where.levelId = filter.levelId;
		}
		if (filter.status) {
			where.status = filter.status;
		}

		const orderField = filter.orderBy ?? LevelRewardSortField.CREATED_AT;
		const orderDir = filter.orderDirection ?? SortOrder.DESC;
		const order: FindOptionsOrder<LevelReward> = {
			[orderField]: orderDir,
		};

		const [list, count] = await this.rewardModel.findAndCount({
			where,
			order,
			take: filter.take ?? 50,
			skip: filter.skip ?? 0,
		});

		return [list.map(r => this.toBasic(r)), count];
	}

	async findUncertainClaims(params?: {
		take?: number;
		skip?: number;
	}): Promise<[LevelRewardBasic[], number]> {
		const [claims, count] = await this.rewardModel.findAndCount({
			where: { status: RewardStatus.TIMEOUT_UNCERTAIN },
			relations: { resolvedByAdmin: true, level: true },
			order: { updated_at: 'DESC' },
			take: params?.take ?? 50,
			skip: params?.skip ?? 0,
		});
		return [claims.map(c => this.toBasic(c)), count];
	}

	private toBasic(reward: LevelReward): LevelRewardBasic {
		return {
			id: reward.id,
			playerId: reward.playerId,
			levelId: reward.levelId,
			coinsAmount: reward.coinsAmount,
			roomId: reward.roomId,
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
