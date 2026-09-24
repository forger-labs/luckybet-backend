import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { MissionRewardBasic } from '../../app/dto/reward.schema';
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
		return reward ? this.toBasic(reward) : null;
	}

	async findById(id: number): Promise<MissionRewardBasic | null> {
		const reward = await this.rewardModel.findOne({
			where: { id },
			relations: { userMission: { mission: true } },
		});
		return reward ? this.toBasic(reward) : null;
	}

	async findPendingByPlayer(playerId: number): Promise<MissionRewardBasic[]> {
		const rewards = await this.rewardModel.find({
			where: {
				playerId,
				status: RewardStatus.PENDING,
			},
			relations: { userMission: { mission: true } },
			order: { created_at: 'DESC' },
		});
		return rewards.map(r => this.toBasic(r));
	}

	async findUncertainRewards(params?: {
		take?: number;
		skip?: number;
	}): Promise<[MissionRewardBasic[], number]> {
		const [rewards, count] = await this.rewardModel.findAndCount({
			where: { status: RewardStatus.TIMEOUT_UNCERTAIN },
			relations: { userMission: { mission: true, player: true } },
			order: { updated_at: 'DESC' },
			take: params?.take ?? 50,
			skip: params?.skip ?? 0,
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
			claimedAt?: Date | null;
		},
	): Promise<MissionRewardBasic> {
		await this.rewardModel.update(id, {
			status,
			externalOperationId: options?.externalOperationId,
			errorMessage: options?.errorMessage,
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
			experiencePoints: reward.experiencePoints,
			status: reward.status,
			externalOperationId: reward.externalOperationId,
			errorMessage: reward.errorMessage,
			claimedAt: reward.claimedAt,
			missionTitle: reward.userMission?.mission?.title,
		};
	}
}
