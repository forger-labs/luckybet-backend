import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { chestBasicSchema } from '../../../chests/app/dto/chest.schema';
import { type RewardAction, RewardStatus } from '../../../rewards/app/enums';
import {
	apiResponseSchema,
	paginatedResponseSchema,
} from '../../../shared/swagger/apiResponse.schema';
import { zDateHelper } from '../../../shared/swagger/date.schema';

export enum ChestProgressState {
	LOCKED = 'LOCKED',
	UNLOCKED = 'UNLOCKED',
	CLAIMED = 'CLAIMED',
	TIMEOUT_UNCERTAIN = 'TIMEOUT_UNCERTAIN',
}

export enum PlayerChestSortField {
	CREATED_AT = 'created_at',
	PERIOD_KEY = 'periodKey',
	ID = 'id',
}

export enum SortOrder {
	ASC = 'ASC',
	DESC = 'DESC',
}

export const resolveUncertainChestClaimSchema = z.object({
	action: z
		.enum(['RESOLVE_CLAIMED', 'FORCE_RETRY'])
		.describe('Accion para resolver el reclamo incierto del cofre'),
	externalOperationId: z
		.string()
		.optional()
		.describe('ID de operacion en LuckyBet si ya se habia asentado'),
	adminNotes: z.string().optional().describe('Notas u observaciones del administrador'),
});

export const playerChestProgressSchema = z.object({
	chest: chestBasicSchema,
	periodKey: z.string().describe('Identificador del periodo (ej: 2026-W39, 2026-09)'),
	completedMissions: z
		.number()
		.int()
		.describe('Misiones completadas por el jugador en este periodo'),
	requiredMissions: z
		.number()
		.int()
		.describe('Misiones requeridas para desbloquear el cofre'),
	state: z.enum(ChestProgressState).describe('Estado del cofre para el jugador'),
	claimedAt: zDateHelper.nullable().optional(),
});

export const userMissionChestSchema = z.object({
	id: z.number().int(),
	playerId: z.number().int(),
	chestId: z.number().int(),
	periodKey: z.string(),
	completedMissionsCount: z.number().int(),
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

export const playerChestFilterSchema = z.object({
	chestId: z.coerce.number().int().positive().optional().describe('Filtrar por cofre'),
	status: z.enum(RewardStatus).optional().describe('Filtrar por estado del reclamo'),
	periodKey: z
		.string()
		.optional()
		.describe('Filtrar por periodo (ej: 2026-W39, 2026-09)'),
	orderBy: z
		.enum(PlayerChestSortField)
    .default(PlayerChestSortField.CREATED_AT)
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

export type PlayerChestProgress = z.infer<typeof playerChestProgressSchema>;
export type UserMissionChestBasic = z.infer<typeof userMissionChestSchema>;
export type PlayerChestFilter = z.infer<typeof playerChestFilterSchema>;

export const SinglePlayerChestProgressResponseSchema = apiResponseSchema(
	playerChestProgressSchema,
);
export const PlayerChestProgressResponseSchema = apiResponseSchema(
	z.array(playerChestProgressSchema),
);
export const ClaimChestResponseSchema = apiResponseSchema(userMissionChestSchema);
export const UserMissionChestListResponseSchema =
	paginatedResponseSchema(userMissionChestSchema);

export class SinglePlayerChestProgressResponseDto extends createZodDto(
	SinglePlayerChestProgressResponseSchema,
) {}
export class PlayerChestProgressResponseDto extends createZodDto(
	PlayerChestProgressResponseSchema,
) {}
export class ClaimChestResponseDto extends createZodDto(ClaimChestResponseSchema) {}
export class UserMissionChestListResponseDto extends createZodDto(
	UserMissionChestListResponseSchema,
) {}
export class ResolveUncertainChestClaimDto extends createZodDto(
	resolveUncertainChestClaimSchema,
) {}
export class PlayerChestFilterDto extends createZodDto(playerChestFilterSchema) {}
