import { CreateMissionDto } from '../../app/dto/create-mission.dto';
import type { MissionBasic, MissionWithSteps } from '../../app/dto/mission.schema';
import { UpdateMissionDto } from '../../app/dto/update-mission.dto';

export type UpdateMissionData = Omit<UpdateMissionDto, 'imageUrl'> & {
	imageUrl?: string | null;
};

export interface ForDatabaseMissions {
	createMission(data: CreateMissionDto): Promise<MissionWithSteps>;

	findById(id: number): Promise<MissionBasic | null>;

	findByIdWithSteps(id: number): Promise<MissionWithSteps | null>;

	getMissions(params: {
		take?: number;
		skip?: number;
	}): Promise<[MissionWithSteps[], number]>;

	updateMission(id: number, data: UpdateMissionData): Promise<MissionBasic | null>;

	activateMission(id: number): Promise<MissionBasic>;

	findActiveMissions(): Promise<MissionBasic[]>;
}
