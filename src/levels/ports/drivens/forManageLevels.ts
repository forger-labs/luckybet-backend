import type {
	CreateLevelMultipart,
	LevelsFilter,
	LevelType,
	UpdateLevelMultipart,
} from '../../app/dto/level.schema';

export interface ForManageLevels {
	createLevel(data: CreateLevelMultipart): Promise<LevelType>;
	updateLevel(id: number, data: UpdateLevelMultipart): Promise<LevelType>;
	getLevelById(id: number): Promise<LevelType>;
	getLevels(params: { take?: number; skip?: number; filter?: LevelsFilter }): Promise<{
		levels: LevelType[];
		total: number;
		limit: number;
		skip: number;
	}>;
	getLowestLevel(): Promise<LevelType | null>;
}
