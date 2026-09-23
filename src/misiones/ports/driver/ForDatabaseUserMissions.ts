import type { FindOptionsWhere } from 'typeorm';

import type {
	UserMissionBasic,
	UserMissionWithSteps,
} from '../../app/dto/mission.schema';
import type { UserMission } from '../../app/entities/user-mission.entity';
import { UserMissionStatus } from '../../app/enums';

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
		params: { take?: number; skip?: number },
	): Promise<[UserMissionBasic[], number]>;

	findByIdWithSteps(id: number): Promise<UserMissionWithSteps | null>;

	findUserMissionsWithContext(
		where: FindOptionsWhere<UserMission>,
	): Promise<UserMission[]>;

	updateCurrentStep(id: number, step: number): Promise<UserMissionBasic>;

	updateStatus(id: number, status: UserMissionStatus): Promise<UserMissionBasic>;
}
