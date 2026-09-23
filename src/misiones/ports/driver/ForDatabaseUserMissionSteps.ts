import type { StepSubmission } from '../../app/dto/mission.schema';
import { StepStatus } from '../../app/enums';

export interface ForDatabaseUserMissionSteps {
	createOrUpdateSubmission(data: {
		userMissionId: number;
		missionStepId: number;
		submissionText?: string;
		submissionImageUrl?: string;
	}): Promise<StepSubmission>;

	findByUserMissionAndStep(
		userMissionId: number,
		missionStepId: number,
	): Promise<StepSubmission | null>;

	findByUserMission(userMissionId: number): Promise<StepSubmission[]>;

	reviewStep(
		id: number,
		status: StepStatus,
		adminId: number,
		notes?: string,
	): Promise<StepSubmission>;
}
