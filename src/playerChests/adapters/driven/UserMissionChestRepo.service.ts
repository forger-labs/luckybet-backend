import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsOrder, FindOptionsWhere, Repository } from 'typeorm';

import { RewardStatus } from '../../../rewards/app/enums';
import {
	PlayerChestFilter,
	PlayerChestSortField,
	SortOrder,
	type UserMissionChestBasic,
} from '../../app/dto/player-chest.schema';
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
			relations: { room: true },
		});
		return found ? this.toBasic(found) : null;
	}

	async findById(id: number): Promise<UserMissionChestBasic | null> {
		const found = await this.claimModel.findOne({ where: { id }, relations: {player: {room: true}, room: true} });
		return found ? this.toBasic(found) : null;
	}

	/**
	 * Intenta insertar o adquirir un reclamo de cofre.
	 * Por defecto en estado PROCESSING para reclamos.
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
				coinsAmount: data.coinsAmount,
				roomId: data.roomId,
				status: data.status ?? RewardStatus.PROCESSING,
			});
			const saved = await this.claimModel.save(entity);
			return this.toBasic(saved);
		} catch {
			// Violación de restricción UNIQUE -> ya existe un registro para este periodo
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
			completedMissionsCount?: number;
		},
	): Promise<UserMissionChestBasic> {
		await this.claimModel.update(id, {
			status,
			externalOperationId: options?.externalOperationId,
			errorMessage: options?.errorMessage,
			resolvedByAdminId: options?.resolvedByAdminId,
			claimedAt: options?.claimedAt,
			...(options?.completedMissionsCount !== undefined
				? { completedMissionsCount: options.completedMissionsCount }
				: {}),
		});

		const updated = await this.claimModel.findOne({ where: { id } });
		// biome-ignore lint/style/noNonNullAssertion: verified updated
		return this.toBasic(updated!);
	}

	async getPlayerChests(
		filter?: PlayerChestFilter,
		overridePlayerId?: number,
	): Promise<[UserMissionChestBasic[], number]> {
		const where: FindOptionsWhere<UserMissionChest> = {};
		if (overridePlayerId !== undefined) {
			where.playerId = overridePlayerId;
		} else if (filter?.playerId !== undefined && filter?.playerId !== null) {
			where.playerId = filter.playerId;
		}

		if (filter?.chestId) {
			where.chestId = filter.chestId;
		}
		if (filter?.status) {
			where.status = filter.status;
		}
		if (filter?.periodKey) {
			where.periodKey = filter.periodKey;
		}

		const orderField = filter?.orderBy ?? PlayerChestSortField.CREATED_AT;
		const orderDir = filter?.orderDirection ?? SortOrder.DESC;
		const order: FindOptionsOrder<UserMissionChest> = {
			[orderField]: orderDir,
		};

		const [list, count] = await this.claimModel.findAndCount({
			where,
			order,
			take: filter?.take ?? 50,
			skip: filter?.skip ?? 0,
			select: {
				id: true,
				playerId: true,
				chestId: true,
				periodKey: true,
				completedMissionsCount: true,
				coinsAmount: true,
				roomId: true,
				status: true,
				externalOperationId: true,
				errorMessage: true,
        resolvedByAdminId: true,
				claimedAt: true,
				created_at: true,
				player: {
					id: true,
					username: true,
				},
				resolvedByAdmin: {
					id: true,
					username: true,
				},
				room: { id: true, name: true, bonus: true },
				chest: {
					id: true,
					imageUrl: true,
					description: true,
					requiredMissions: true,
					title: true,
				},
			},
			relations: { player: true, room: true, resolvedByAdmin: true, chest: true },
		});

		return [list.map(c => this.toBasic(c)), count];
	}

	private toBasic(claim: UserMissionChest): UserMissionChestBasic {
		return {
			id: claim.id,
			playerId: claim.playerId,
			chestId: claim.chestId,
			periodKey: claim.periodKey,
			completedMissionsCount: claim.completedMissionsCount,
			coinsAmount: claim.coinsAmount,
			roomId: claim.roomId,
			status: claim.status,
			externalOperationId: claim.externalOperationId,
			errorMessage: claim.errorMessage,
			resolvedByAdminId: claim.resolvedByAdminId,
			claimedAt: claim.claimedAt ? claim.claimedAt.toISOString() : null,
			createdAt: claim.created_at ? claim.created_at.toISOString() : undefined,
			updatedAt: claim.updated_at ? claim.updated_at.toISOString() : undefined,
			chest: claim.chest ? claim.chest : undefined,
			player: claim.player ? claim.player : undefined,
			resolvedByAdmin: claim.resolvedByAdmin ? claim.resolvedByAdmin : undefined,
			room: claim.room ? claim.room : undefined,
		};
	}
}
