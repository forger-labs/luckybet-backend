import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { apiResponseSchema } from '../../../shared/swagger/apiResponse.schema';

export const operationalRiskSchema = z.object({
	uncertainClaimsCount: z
		.number()
		.int()
		.nonnegative()
		.describe('Total de reclamos en estado TIMEOUT_UNCERTAIN'),
	uncertainCoinsAmount: z
		.number()
		.int()
		.nonnegative()
		.describe('Total de fichas retenidas en estado TIMEOUT_UNCERTAIN'),
	breakdown: z.object({
		missions: z.object({
			count: z.number().int().nonnegative(),
			coinsAmount: z.number().int().nonnegative(),
		}),
		levels: z.object({
			count: z.number().int().nonnegative(),
			coinsAmount: z.number().int().nonnegative(),
		}),
		chests: z.object({
			count: z.number().int().nonnegative(),
			coinsAmount: z.number().int().nonnegative(),
		}),
	}),
});

export type OperationalRisk = z.infer<typeof operationalRiskSchema>;

export const OperationalRiskResponseSchema = apiResponseSchema(operationalRiskSchema);
export class OperationalRiskResponseDto extends createZodDto(
	OperationalRiskResponseSchema,
) {}

export const reviewerSlaItemSchema = z.object({
	adminId: z.number().int().positive(),
	adminUsername: z.string(),
	reviewedStepsCount: z.number().int().nonnegative(),
	approvedStepsCount: z.number().int().nonnegative(),
	rejectedStepsCount: z.number().int().nonnegative(),
	averageReviewTimeMinutes: z
		.number()
		.nonnegative()
		.describe('Tiempo promedio de revisión en minutos para este admin'),
});

export const reviewersSlaSchema = z.object({
	globalAverageReviewTimeMinutes: z
		.number()
		.nonnegative()
		.describe('Tiempo promedio global de revisión en minutos'),
	totalReviewedStepsCount: z
		.number()
		.int()
		.nonnegative()
		.describe('Cantidad total de steps revisados en el rango'),
	reviewers: z.array(reviewerSlaItemSchema),
});

export type ReviewerSlaItem = z.infer<typeof reviewerSlaItemSchema>;
export type ReviewersSla = z.infer<typeof reviewersSlaSchema>;

export const ReviewersSlaResponseSchema = apiResponseSchema(reviewersSlaSchema);
export class ReviewersSlaResponseDto extends createZodDto(ReviewersSlaResponseSchema) {}
