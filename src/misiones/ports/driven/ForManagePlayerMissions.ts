import type { UploadableFile } from '../../../shared/storage/storage.port';
import type {
	ReviewQueueByPlayer,
	StepSubmission,
	UserMissionBasic,
	UserMissionWithSteps,
} from '../../app/dto/mission.schema';
import { StepStatus } from '../../app/enums';

export type PlayerMissionsQueueFilters = {
	status?: string;
	playerId?: number;
	experience?: number;
	coinsAmount?: number;
	type?: string;
	take?: number;
	skip?: number;
};

export type PlayerMissionsQueueResult = {
	players: ReviewQueueByPlayer[];
	total: number;
	limit: number;
	skip: number;
};

export interface ForManagePlayerMissions {
	startMission(playerId: number, missionId: number): Promise<UserMissionBasic>;

	submitStep(
		userMissionId: number,
		stepId: number,
		data: { submissionText?: string; submissionImage?: UploadableFile },
	): Promise<StepSubmission>;

	reviewStep(
		stepId: number,
		status: StepStatus.APPROVED | StepStatus.REJECTED,
		adminId: number,
		notes?: string,
	): Promise<StepSubmission>;

	getPlayerMissions(
		playerId: number,
		params: { take?: number; skip?: number },
	): Promise<{
		missions: UserMissionBasic[];
		total: number;
		limit: number;
		skip: number;
	}>;

	getPlayerMission(id: number): Promise<UserMissionWithSteps>;

	getPlayerMissionsQueue(
		filters: PlayerMissionsQueueFilters,
	): Promise<PlayerMissionsQueueResult>;
}
