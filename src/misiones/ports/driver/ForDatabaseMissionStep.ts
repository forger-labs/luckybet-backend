import type { MissionStepBasic } from '../../app/dto/mission.schema';
import type { StepTargetConfig } from '../../app/entities/mission-step.entity';
import { StepType } from '../../app/enums';

export type CreateMissionStepInput = {
	stepOrder: number;
	type: StepType;
	content?: string;
	targetConfig?: StepTargetConfig | null;
};

export interface ForDatabaseMissionStep {
	createMany(
		missionId: number,
		steps: CreateMissionStepInput[],
	): Promise<MissionStepBasic[]>;
}
