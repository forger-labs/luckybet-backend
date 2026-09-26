import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
	apiResponseSchema,
	paginatedResponseSchema,
} from '../../../shared/swagger/apiResponse.schema';
import { zDateHelper } from '../../../shared/swagger/date.schema';
import { RewardStatus } from '../enums';

export enum RewardSortField {
	CREATED_AT = 'created_at',
	ID = 'id',
}

export enum SortOrder {
	ASC = 'ASC',
	DESC = 'DESC',
}

export const resolveUncertainRewardSchema = z.object({
	action: z
		.enum(['RESOLVE_CLAIMED', 'FORCE_RETRY'])
		.describe('Accion para resolver el reclamo incierto'),
	externalOperationId: z
		.string()
		.optional()
		.describe('ID de operacion en LuckyBet si ya se habia asentado'),
	adminNotes: z.string().optional().describe('Notas u observaciones del administrador'),
});

export const missionRewardSchema = z.object({
	id: z.number().int(),
	userMissionId: z.number().int(),
	playerId: z.number().int(),
	coinsAmount: z.number().int(),
	roomId: z.number().int().nullable().optional(),
	experiencePoints: z.number().int(),
	status: z.enum(RewardStatus),
	externalOperationId: z.string().nullable().optional(),
	errorMessage: z.string().nullable().optional(),
	resolvedByAdminId: z.number().int().nullable().optional(),
	claimedAt: zDateHelper.nullable().optional(),
	missionTitle: z.string().optional(),
	createdAt: zDateHelper.optional(),
	updatedAt: zDateHelper.optional(),
});

export const rewardFilterSchema = z.object({
	status: z.enum(RewardStatus).optional().describe('Filtrar por estado del reclamo'),
	userMissionId: z.coerce
		.number()
		.int()
		.positive()
		.optional()
		.describe('Filtrar por ID de misión de usuario'),
	playerId: z.coerce
		.number()
		.int()
		.positive()
		.optional()
		.describe('Filtrar por jugador (solo admin)'),
	orderBy: z
		.enum(RewardSortField)
		.default(RewardSortField.CREATED_AT)
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
		.describe('Cantidad de registros por página (máx: 100)'),
	skip: z.coerce.number().int().min(0).default(0).describe('Paginación / Offset'),
});

export type MissionRewardBasic = {
	id: number;
	userMissionId: number;
	playerId: number;
	coinsAmount: number;
	roomId?: number | null;
	experiencePoints: number;
	status: RewardStatus;
	externalOperationId?: string | null;
	errorMessage?: string | null;
	resolvedByAdminId?: number | null;
	claimedAt?: Date | string | null;
	missionTitle?: string;
	createdAt?: Date | string;
	updatedAt?: Date | string;
};

export type RewardFilter = z.infer<typeof rewardFilterSchema>;

export const MissionRewardResponseSchema = apiResponseSchema(missionRewardSchema);
export const MissionRewardListResponseSchema =
	paginatedResponseSchema(missionRewardSchema);

export class MissionRewardResponseDto extends createZodDto(MissionRewardResponseSchema) {}
export class MissionRewardListResponseDto extends createZodDto(
	MissionRewardListResponseSchema,
) {}
export class ResolveUncertainRewardDto extends createZodDto(
	resolveUncertainRewardSchema,
) {}
export class RewardFilterDto extends createZodDto(rewardFilterSchema) {}
