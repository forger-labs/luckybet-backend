import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { MissionStepBasic } from '../../app/dto/mission.schema';
import { MissionStep } from '../../app/entities/mission-step.entity';
import type {
	CreateMissionStepInput,
	ForDatabaseMissionStep,
} from '../../ports/driver/ForDatabaseMissionStep';

@Injectable()
export class MissionStepRepoService implements ForDatabaseMissionStep {
	constructor(
		@InjectRepository(MissionStep)
		private readonly stepModel: Repository<MissionStep>,
	) {}

	async createMany(
		missionId: number,
		steps: CreateMissionStepInput[],
	): Promise<MissionStepBasic[]> {
		if (steps.length === 0) return [];

		const entities = steps.map(step =>
			this.stepModel.create({
				missionId,
				stepOrder: step.stepOrder,
				type: step.type,
				content: step.content,
			}),
		);
		const saved = await this.stepModel.save(entities);
		return saved.map(s => this.toBasic(s));
	}

	private toBasic(step: MissionStep): MissionStepBasic {
		return {
			id: step.id,
			missionId: step.missionId,
			stepOrder: step.stepOrder,
			type: step.type,
			content: step.content,
		};
	}
}
