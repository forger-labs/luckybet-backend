import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { chestBasicSchema } from '../../../chests/app/dto/chest.schema';
import { RewardStatus, type RewardAction } from '../../../rewards/app/enums';
import {
	apiResponseSchema,
	paginatedResponseSchema,
} from '../../../shared/swagger/apiResponse.schema';

export enum ChestProgressState {
	LOCKED = 'LOCKED',
	UNLOCKED = 'UNLOCKED',
	CLAIMED = 'CLAIMED',
	TIMEOUT_UNCERTAIN = 'TIMEOUT_UNCERTAIN',
}

export const resolveUncertainChestClaimSchema = z.object({
	action: z.enum(['RESOLVE_CLAIMED', 'FORCE_RETRY']).describe('Accion para resolver el reclamo incierto del cofre'),
	externalOperationId: z.string().optional().describe('ID de operacion en LuckyBet si ya se habia asentado'),
	adminNotes: z.string().optional().describe('Notas u observaciones del administrador'),
});

export const playerChestProgressSchema = z.object({
	chest: chestBasicSchema,
	periodKey: z.string().describe('Identificador del periodo (ej: 2026-W39, 2026-09)'),
	completedMissions: z.number().int().describe('Misiones completadas por el jugador en este periodo'),
	requiredMissions: z.number().int().describe('Misiones requeridas para desbloquear el cofre'),
	state: z.enum(ChestProgressState).describe('Estado del cofre para el jugador'),
	claimedAt: z.date().nullable().optional(),
});

export const userMissionChestSchema = z.object({
	id: z.number().int(),
	playerId: z.number().int(),
	chestId: z.number().int(),
	periodKey: z.string(),
	completedMissionsCount: z.number().int(),
	status: z.enum(RewardStatus),
	externalOperationId: z.string().nullable().optional(),
	errorMessage: z.string().nullable().optional(),
	resolvedByAdminId: z.number().int().nullable().optional(),
	claimedAt: z.date().nullable().optional(),
});

export type PlayerChestProgress = z.infer<typeof playerChestProgressSchema>;
export type UserMissionChestBasic = z.infer<typeof userMissionChestSchema>;

export const PlayerChestProgressResponseSchema = apiResponseSchema(z.array(playerChestProgressSchema));
export const ClaimChestResponseSchema = apiResponseSchema(userMissionChestSchema);
export const UserMissionChestListResponseSchema = paginatedResponseSchema(userMissionChestSchema);

export class PlayerChestProgressResponseDto extends createZodDto(PlayerChestProgressResponseSchema) {}
export class ClaimChestResponseDto extends createZodDto(ClaimChestResponseSchema) {}
export class UserMissionChestListResponseDto extends createZodDto(UserMissionChestListResponseSchema) {}
export class ResolveUncertainChestClaimDto extends createZodDto(resolveUncertainChestClaimSchema) {}
