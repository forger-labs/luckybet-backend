import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { apiResponseSchema } from '../../../shared/swagger/apiResponse.schema';

export const missionsEngagementSchema = z.object({
	completionRate: z
		.number()
		.min(0)
		.max(100)
		.describe('Porcentaje de misiones completadas vs iniciadas'),
	completedCount: z.number().int().nonnegative(),
	inProgressCount: z
		.number()
		.int()
		.nonnegative()
		.describe('Misiones actualmente en progreso'),
	cancelledOrExpiredCount: z.number().int().nonnegative(),
	averageCompletionMinutes: z
		.number()
		.nonnegative()
		.describe('Tiempo promedio de completitud en minutos'),
});

export type MissionsEngagement = z.infer<typeof missionsEngagementSchema>;

export const MissionsEngagementResponseSchema = apiResponseSchema(
	missionsEngagementSchema,
);
export class MissionsEngagementResponseDto extends createZodDto(
	MissionsEngagementResponseSchema,
) {}

export const levelDistributionItemSchema = z.object({
	levelId: z.number().int().positive(),
	levelName: z.string(),
	minExperience: z.number().int().nonnegative(),
	playersCount: z.number().int().nonnegative(),
	percentage: z
		.number()
		.min(0)
		.max(100)
		.describe('Porcentaje sobre el total de jugadores activos'),
});

export const levelsDistributionSchema = z.object({
	totalActivePlayers: z.number().int().nonnegative(),
	distribution: z.array(levelDistributionItemSchema),
});

export type LevelDistributionItem = z.infer<typeof levelDistributionItemSchema>;
export type LevelsDistribution = z.infer<typeof levelsDistributionSchema>;

export const LevelsDistributionResponseSchema = apiResponseSchema(
	levelsDistributionSchema,
);
export class LevelsDistributionResponseDto extends createZodDto(
	LevelsDistributionResponseSchema,
) {}

export const chestSummaryFilterSchema = z.object({
	periodKey: z
		.string()
		.optional()
		.describe('Clave del periodo (ej: 2026-W10 o 2026-03). Por defecto periodo actual.'),
});

export type ChestSummaryFilter = z.infer<typeof chestSummaryFilterSchema>;
export class ChestSummaryFilterDto extends createZodDto(chestSummaryFilterSchema) {}

export const chestSummaryItemSchema = z.object({
	chestId: z.number().int().positive(),
	chestTitle: z.string(),
	requiredMissions: z.number().int().positive(),
	coinsAmount: z.number().int().nonnegative(),
	periodType: z.string(),
	participantsCount: z.number().int().nonnegative(),
	claimedCount: z.number().int().nonnegative(),
	claimRate: z.number().min(0).max(100),
	totalCoinsDistributed: z.number().int().nonnegative(),
});

export const chestsSummarySchema = z.object({
	periodKey: z.string(),
	chests: z.array(chestSummaryItemSchema),
});

export type ChestSummaryItem = z.infer<typeof chestSummaryItemSchema>;
export type ChestsSummary = z.infer<typeof chestsSummarySchema>;

export const ChestsSummaryResponseSchema = apiResponseSchema(chestsSummarySchema);
export class ChestsSummaryResponseDto extends createZodDto(ChestsSummaryResponseSchema) {}
