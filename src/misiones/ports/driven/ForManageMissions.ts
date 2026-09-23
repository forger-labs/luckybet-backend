import type { UploadableFile } from '../../../shared/storage/storage.port';
import type { CreateMissionMultipartDto } from '../../app/dto/create-mission.dto';
import type { MissionBasic, MissionWithSteps } from '../../app/dto/mission.schema';
import type { UpdateMissionDto } from '../../app/dto/update-mission.dto';
import { MissionStatus } from '../../app/enums';

export interface ForManageMissions {
	createMission(data: CreateMissionMultipartDto): Promise<MissionWithSteps>;

	getMission(id: number): Promise<MissionWithSteps>;

	listMissions(params: { take?: number; skip?: number }): Promise<{
		missions: MissionWithSteps[];
		total: number;
		limit: number;
		skip: number;
	}>;

	updateMission(id: number, data: UpdateMissionDto): Promise<MissionBasic>;

	activateMission(id: number): Promise<MissionBasic>;

	changeMissionStatus(id: number, status: MissionStatus): Promise<MissionBasic>;

	replaceMissionImage(id: number, file: UploadableFile): Promise<MissionBasic>;

	deleteMissionImage(id: number): Promise<MissionBasic>;
}
