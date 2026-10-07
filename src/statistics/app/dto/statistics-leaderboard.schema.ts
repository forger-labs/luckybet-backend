import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { apiResponseSchema } from '../../../shared/swagger/apiResponse.schema';

export enum LeaderboardPeriod {
	WEEKLY = 'WEEKLY',
	MONTHLY = 'MONTHLY',
	ALL_TIME = 'ALL_TIME',
}

export const leaderboardFilterSchema = z.object({
	period: z
		.enum(LeaderboardPeriod)
		.default(LeaderboardPeriod.ALL_TIME)
		.optional()
		.describe('Periodo de tiempo para el ranking: WEEKLY, MONTHLY o ALL_TIME'),
	limit: z.coerce
		.number()
		.int()
		.positive()
		.max(100)
		.default(20)
		.optional()
		.describe('Cantidad máxima de jugadores en el ranking (máx: 100)'),
});

export type LeaderboardFilter = z.infer<typeof leaderboardFilterSchema>;
export class LeaderboardFilterDto extends createZodDto(leaderboardFilterSchema) {}

export const leaderboardEntrySchema = z.object({
	rank: z.number().int().positive().describe('Posición en el ranking'),
	playerId: z.number().int().positive(),
	username: z.string(),
	totalCoins: z
		.number()
		.int()
		.nonnegative()
		.describe('Total de fichas reclamadas en el periodo'),
	missionsCoins: z.number().int().nonnegative(),
	levelsCoins: z.number().int().nonnegative(),
	chestsCoins: z.number().int().nonnegative(),
});

export const leaderboardResponseSchema = z.object({
	period: z.enum(LeaderboardPeriod),
	startDate: z.string().nullable().optional(),
	endDate: z.string().nullable().optional(),
	leaderboard: z.array(leaderboardEntrySchema),
});

export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
export type LeaderboardResult = z.infer<typeof leaderboardResponseSchema>;

export const LeaderboardApiResponseSchema = apiResponseSchema(leaderboardResponseSchema);
export class LeaderboardApiResponseDto extends createZodDto(
	LeaderboardApiResponseSchema,
) {}
