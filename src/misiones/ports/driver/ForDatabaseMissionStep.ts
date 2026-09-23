import type { MissionStepBasic } from '../../app/dto/mission.schema';
import { StepType } from '../../app/enums';

export type CreateMissionStepInput = {
	stepOrder: number;
	type: StepType;
	content?: string;
};

export interface ForDatabaseMissionStep {
	createMany(
		missionId: number,
		steps: CreateMissionStepInput[],
	): Promise<MissionStepBasic[]>;
}
