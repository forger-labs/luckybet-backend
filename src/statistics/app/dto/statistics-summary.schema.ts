import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { apiResponseSchema } from '../../../shared/swagger/apiResponse.schema';

export const statisticsSummarySchema = z.object({
	coinsBreakdown: z.object({
		missionsCoins: z
			.number()
			.int()
			.nonnegative()
			.describe('Fichas regaladas por misiones reclamadas'),
		levelsCoins: z
			.number()
			.int()
			.nonnegative()
			.describe('Fichas regaladas por ascensos de nivel reclamados'),
		chestsCoins: z
			.number()
			.int()
			.nonnegative()
			.describe('Fichas regaladas por cofres reclamados'),
		totalCoins: z
			.number()
			.int()
			.nonnegative()
			.describe('Total de fichas regaladas emitidas'),
	}),
	eventsCount: z.object({
		completedMissionsCount: z
			.number()
			.int()
			.nonnegative()
			.describe('Cantidad de misiones completadas en el rango temporal'),
		levelUpsCount: z
			.number()
			.int()
			.nonnegative()
			.describe('Cantidad de ascensos de nivel registrados en el rango temporal'),
		claimedChestsCount: z
			.number()
			.int()
			.nonnegative()
			.describe('Cantidad de cofres reclamados en el rango temporal'),
	}),
});

export type StatisticsSummary = z.infer<typeof statisticsSummarySchema>;

export const StatisticsSummaryResponseSchema = apiResponseSchema(statisticsSummarySchema);
export class StatisticsSummaryResponseDto extends createZodDto(
	StatisticsSummaryResponseSchema,
) {}
