import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { apiResponseSchema } from '../../../shared/swagger/apiResponse.schema';

export const statisticsLiabilitiesSchema = z.object({
	pendingCoins: z
		.number()
		.int()
		.nonnegative()
		.describe('Total de fichas en estado PENDING'),
	claimedCoins: z
		.number()
		.int()
		.nonnegative()
		.describe('Total de fichas en estado CLAIMED'),
	claimRate: z
		.number()
		.min(0)
		.max(100)
		.describe('Porcentaje de reclamo (claimed / (claimed + pending))'),
	pendingClaimsCount: z
		.number()
		.int()
		.nonnegative()
		.describe('Cantidad total de premios en estado PENDING sin reclamar'),
	breakdown: z.object({
		missionsPendingCoins: z.number().int().nonnegative(),
		levelsPendingCoins: z.number().int().nonnegative(),
		chestsPendingCoins: z.number().int().nonnegative(),
	}),
});

export type StatisticsLiabilities = z.infer<typeof statisticsLiabilitiesSchema>;

export const StatisticsLiabilitiesResponseSchema = apiResponseSchema(
	statisticsLiabilitiesSchema,
);
export class StatisticsLiabilitiesResponseDto extends createZodDto(
	StatisticsLiabilitiesResponseSchema,
) {}
