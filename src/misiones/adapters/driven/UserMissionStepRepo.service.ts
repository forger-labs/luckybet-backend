import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { StepSubmission } from '../../app/dto/mission.schema';
import { UserMissionStep } from '../../app/entities/user-mission-step.entity';
import { StepStatus } from '../../app/enums';
import { ForDatabaseUserMissionSteps } from '../../ports/driver/ForDatabaseUserMissionSteps';

@Injectable()
export class UserMissionStepRepoService implements ForDatabaseUserMissionSteps {
	constructor(
		@InjectRepository(UserMissionStep)
		private readonly stepModel: Repository<UserMissionStep>,
	) {}

	async createOrUpdateSubmission(data: {
		userMissionId: number;
		missionStepId: number;
		submissionText?: string;
		submissionImageUrl?: string;
	}): Promise<StepSubmission> {
		const existing = await this.stepModel.findOne({
			where: {
				userMissionId: data.userMissionId,
				missionStepId: data.missionStepId,
			},
		});

		if (existing) {
			existing.submissionText = data.submissionText;
			existing.submissionImageUrl = data.submissionImageUrl;
			existing.status = StepStatus.PENDING;
			existing.reviewedById = undefined;
			existing.reviewedAt = undefined;
			existing.reviewerNotes = undefined;
			const saved = await this.stepModel.save(existing);
			return this.toSubmission(saved);
		}

		const step = this.stepModel.create({
			userMissionId: data.userMissionId,
			missionStepId: data.missionStepId,
			submissionText: data.submissionText,
			submissionImageUrl: data.submissionImageUrl,
		});
		const saved = await this.stepModel.save(step);
		return this.toSubmission(saved);
	}

	async findByUserMissionAndStep(
		userMissionId: number,
		missionStepId: number,
	): Promise<StepSubmission | null> {
		const step = await this.stepModel.findOne({
			where: { userMissionId, missionStepId },
		});
		return step ? this.toSubmission(step) : null;
	}

	async findByUserMission(userMissionId: number): Promise<StepSubmission[]> {
		const steps = await this.stepModel.find({
			where: { userMissionId },
		});
		return steps.map(s => this.toSubmission(s));
	}

	async reviewStep(
		id: number,
		status: StepStatus,
		adminId: number,
		notes?: string,
	): Promise<StepSubmission> {
		const step = await this.stepModel.findOne({ where: { id } });
		if (!step) throw new Error('Step submission not found');

		step.status = status;
		step.reviewedById = adminId;
		step.reviewedAt = new Date();
		step.reviewerNotes = notes;

		const saved = await this.stepModel.save(step);
		return this.toSubmission(saved);
	}

	private toSubmission(step: UserMissionStep): StepSubmission {
		return {
			id: step.id,
			userMissionId: step.userMissionId,
			missionStepId: step.missionStepId,
			status: step.status,
			submissionText: step.submissionText,
			submissionImageUrl: step.submissionImageUrl,
			reviewedById: step.reviewedById,
			reviewedAt: step.reviewedAt,
			reviewerNotes: step.reviewerNotes,
		};
	}
}
