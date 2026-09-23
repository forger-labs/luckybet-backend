import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import type {
	StepSubmission,
	UserMissionBasic,
	UserMissionWithSteps,
} from '../../app/dto/mission.schema';
import { UserMission } from '../../app/entities/user-mission.entity';
import { UserMissionStatus } from '../../app/enums';
import { ForDatabaseUserMissions } from '../../ports/driver/ForDatabaseUserMissions';

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
		params: { take?: number; skip?: number },
	): Promise<[UserMissionBasic[], number]> {
		const [list, count] = await this.userMissionModel.findAndCount({
			where: { playerId },
			skip: params.skip,
			take: params.take,
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
		where: FindOptionsWhere<UserMission>,
	): Promise<UserMission[]> {
		return this.userMissionModel.find({
			where,
			relations: { player: true, mission: true, steps: true },
			order: { created_at: 'DESC' },
		});
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
