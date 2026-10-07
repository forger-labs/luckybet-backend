import type {
	CreateLevelType,
	LevelsFilter,
	LevelType,
	UpdateLevelType,
} from '../../app/dto/level.schema';

export interface ForDatabaseLevels {
	findById(id: number): Promise<LevelType | null>;
	findAll(
		limit: number,
		skip: number,
		options?: LevelsFilter,
	): Promise<[LevelType[], number]>;
	findLowestLevel(): Promise<LevelType | null>;
	createLevel(data: CreateLevelType): Promise<LevelType>;
	updateLevel(id: number, data: UpdateLevelType): Promise<LevelType | null>;
}
