import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RewardStatus } from '../../../rewards/app/enums';
import type { UserMissionChestBasic } from '../../app/dto/player-chest.schema';
import { UserMissionChest } from '../../app/entities/user-mission-chest.entity';
import type {
	CreateUserChestInput,
	ForDatabasePlayerChests,
} from '../../ports/driver/ForDatabasePlayerChests';

@Injectable()
export class UserMissionChestRepoService implements ForDatabasePlayerChests {
	constructor(
		@InjectRepository(UserMissionChest)
		private readonly claimModel: Repository<UserMissionChest>,
	) {}

	async findByPlayerAndPeriod(
		playerId: number,
		chestId: number,
		periodKey: string,
	): Promise<UserMissionChestBasic | null> {
		const found = await this.claimModel.findOne({
			where: { playerId, chestId, periodKey },
		});
		return found ? this.toBasic(found) : null;
	}

	async findById(id: number): Promise<UserMissionChestBasic | null> {
		const found = await this.claimModel.findOne({ where: { id } });
		return found ? this.toBasic(found) : null;
	}

	/**
	 * Tries to insert a claim record in PROCESSING status atomically.
	 * If a record with (playerId, chestId, periodKey) already exists, it fails.
	 */
	async acquireClaimLock(
		data: CreateUserChestInput,
	): Promise<UserMissionChestBasic | null> {
		try {
			const entity = this.claimModel.create({
				playerId: data.playerId,
				chestId: data.chestId,
				periodKey: data.periodKey,
				completedMissionsCount: data.completedMissionsCount,
				status: RewardStatus.PROCESSING,
			});
			const saved = await this.claimModel.save(entity);
			return this.toBasic(saved);
		} catch  {
			// Violación de restricción UNIQUE -> ya existe un reclamo para este periodo
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
	): Promise<UserMissionChestBasic> {
		await this.claimModel.update(id, {
			status,
			externalOperationId: options?.externalOperationId,
			errorMessage: options?.errorMessage,
			resolvedByAdminId: options?.resolvedByAdminId,
			claimedAt: options?.claimedAt,
		});

		const updated = await this.claimModel.findOne({ where: { id } });
		// biome-ignore lint/style/noNonNullAssertion: verified updated
		return this.toBasic(updated!);
	}

	async findUncertainClaims(params?: {
		take?: number;
		skip?: number;
	}): Promise<[UserMissionChestBasic[], number]> {
		const [claims, count] = await this.claimModel.findAndCount({
			where: { status: RewardStatus.TIMEOUT_UNCERTAIN },
			relations: { resolvedByAdmin: true, chest: true },
			order: { updated_at: 'DESC' },
			take: params?.take ?? 50,
			skip: params?.skip ?? 0,
		});
		return [claims.map(c => this.toBasic(c)), count];
	}

	private toBasic(claim: UserMissionChest): UserMissionChestBasic {
		return {
			id: claim.id,
			playerId: claim.playerId,
			chestId: claim.chestId,
			periodKey: claim.periodKey,
			completedMissionsCount: claim.completedMissionsCount,
			status: claim.status,
			externalOperationId: claim.externalOperationId,
			errorMessage: claim.errorMessage,
			resolvedByAdminId: claim.resolvedByAdminId,
			claimedAt: claim.claimedAt,
		};
	}
}
