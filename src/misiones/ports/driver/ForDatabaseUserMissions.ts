import type {
	UserMissionBasic,
	UserMissionFilter,
	UserMissionWithSteps,
} from '../../app/dto/mission.schema';
import type { UserMission } from '../../app/entities/user-mission.entity';
import { UserMissionStatus } from '../../app/enums';

export type PlayerMissionsQueueFiltersDB = {
	umStatus?: UserMissionStatus;
	playerId?: number;
	minExperience?: number;
	maxExperience?: number;
	minCoinsAmount?: number;
	maxCoinsAmount?: number;
	type?: string;
};

export interface ForDatabaseUserMissions {
	createUserMission(data: {
		playerId: number;
		missionId: number;
	}): Promise<UserMissionBasic>;

	findById(id: number): Promise<UserMissionBasic | null>;

	findByPlayerAndMission(
		playerId: number,
		missionId: number,
	): Promise<UserMissionBasic | null>;

	findByPlayer(
		playerId: number,
		filter?: UserMissionFilter,
	): Promise<[UserMissionWithSteps[], number]>;

	findByIdWithSteps(id: number): Promise<UserMissionWithSteps | null>;

	findUserMissionsWithContext(
		filters: PlayerMissionsQueueFiltersDB,
		take: number,
		skip: number,
	): Promise<[UserMission[], number]>;

	updateCurrentStep(id: number, step: number): Promise<UserMissionBasic>;

	updateStatus(id: number, status: UserMissionStatus): Promise<UserMissionBasic>;

	countCompletedBetween(
		playerId: number,
		startDate: Date,
		endDate: Date,
	): Promise<number>;
}
