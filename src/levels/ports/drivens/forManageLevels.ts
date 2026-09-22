import type {
	CreateLevelType,
	LevelsFilter,
	LevelType,
	UpdateLevelType,
} from '../../app/dto/level.schema';

export interface ForManageLevels {
	createLevel(data: CreateLevelType): Promise<LevelType>;
	updateLevel(id: number, data: UpdateLevelType): Promise<LevelType>;
	getLevelById(id: number): Promise<LevelType>;
	getLevels(params: { take?: number; skip?: number; filter?: LevelsFilter }): Promise<{
		levels: LevelType[];
		total: number;
		limit: number;
		skip: number;
	}>;
	getLowestLevel(): Promise<LevelType | null>;
}
