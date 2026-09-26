import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { type RewardAction, RewardStatus } from '../../../rewards/app/enums';
import {
	apiResponseSchema,
	paginatedResponseSchema,
} from '../../../shared/swagger/apiResponse.schema';
import { zDateHelper } from '../../../shared/swagger/date.schema';

export enum LevelRewardSortField {
	CREATED_AT = 'created_at',
	LEVEL_ID = 'levelId',
	ID = 'id',
}

export enum SortOrder {
	ASC = 'ASC',
	DESC = 'DESC',
}

export const levelRewardBasicSchema = z.object({
	id: z.number().int(),
	playerId: z.number().int(),
	levelId: z.number().int(),
	coinsAmount: z.number().int(),
	roomId: z.number().int().nullable().optional(),
	status: z.enum(RewardStatus),
	externalOperationId: z.string().nullable().optional(),
	errorMessage: z.string().nullable().optional(),
	resolvedByAdminId: z.number().int().nullable().optional(),
	claimedAt: zDateHelper.nullable().optional(),
	createdAt: zDateHelper.optional(),
	updatedAt: zDateHelper.optional(),
});

export const levelRewardFilterSchema = z.object({
	playerId: z.coerce
		.number()
		.int()
		.positive()
		.optional()
		.describe('Filtrar por jugador (solo admin)'),
	levelId: z.coerce.number().int().positive().optional().describe('Filtrar por nivel'),
	status: z.enum(RewardStatus).optional().describe('Filtrar por estado del reclamo'),
	orderBy: z
		.enum(LevelRewardSortField)
		.default(LevelRewardSortField.CREATED_AT)
		.optional()
		.describe('Campo por el cual ordenar'),
	orderDirection: z
		.enum(SortOrder)
		.default(SortOrder.DESC)
		.optional()
		.describe('Dirección del ordenamiento (ASC o DESC)'),
	take: z.coerce
		.number()
		.int()
		.positive()
		.max(100)
		.default(50)
		.describe('Cantidad de registros'),
	skip: z.coerce.number().int().min(0).default(0).describe('Paginación / Offset'),
});

export const resolveUncertainLevelClaimSchema = z.object({
	action: z
		.enum(['RESOLVE_CLAIMED', 'FORCE_RETRY'])
		.describe('Accion para resolver el reclamo incierto del nivel'),
	externalOperationId: z
		.string()
		.optional()
		.describe('ID de operacion en LuckyBet si ya se habia asentado'),
	adminNotes: z.string().optional().describe('Notas u observaciones del administrador'),
});

export type LevelRewardBasic = z.infer<typeof levelRewardBasicSchema>;
export type LevelRewardFilter = z.infer<typeof levelRewardFilterSchema>;

export const SingleLevelRewardResponseSchema = apiResponseSchema(levelRewardBasicSchema);
export const LevelRewardListResponseSchema =
	paginatedResponseSchema(levelRewardBasicSchema);

export class SingleLevelRewardResponseDto extends createZodDto(
	SingleLevelRewardResponseSchema,
) {}
export class LevelRewardListResponseDto extends createZodDto(
	LevelRewardListResponseSchema,
) {}
export class ResolveUncertainLevelClaimDto extends createZodDto(
	resolveUncertainLevelClaimSchema,
) {}
export class LevelRewardFilterDto extends createZodDto(levelRewardFilterSchema) {}
