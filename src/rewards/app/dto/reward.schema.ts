import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
	apiResponseSchema,
	paginatedResponseSchema,
} from '../../../shared/swagger/apiResponse.schema';
import { RewardStatus } from '../enums';

export const resolveUncertainRewardSchema = z.object({
	action: z.enum(['RESOLVE_CLAIMED', 'FORCE_RETRY']).describe('Accion para resolver el reclamo incierto'),
	externalOperationId: z.string().optional().describe('ID de operacion en LuckyBet si ya se habia asentado'),
	adminNotes: z.string().optional().describe('Notas u observaciones del administrador'),
});

export const missionRewardSchema = z.object({
	id: z.number().int(),
	userMissionId: z.number().int(),
	playerId: z.number().int(),
	coinsAmount: z.number().int(),
	experiencePoints: z.number().int(),
	status: z.enum(RewardStatus),
	externalOperationId: z.string().nullable().optional(),
	errorMessage: z.string().nullable().optional(),
	resolvedByAdminId: z.number().int().nullable().optional(),
	claimedAt: z.date().nullable().optional(),
	missionTitle: z.string().optional(),
});

export type MissionRewardBasic = {
	id: number;
	userMissionId: number;
	playerId: number;
	coinsAmount: number;
	experiencePoints: number;
	status: RewardStatus;
	externalOperationId?: string | null;
	errorMessage?: string | null;
	resolvedByAdminId?: number | null;
	claimedAt?: Date | null;
	missionTitle?: string;
};

export const MissionRewardResponseSchema = apiResponseSchema(missionRewardSchema);
export const MissionRewardListResponseSchema = paginatedResponseSchema(missionRewardSchema);

export class MissionRewardResponseDto extends createZodDto(MissionRewardResponseSchema) {}
export class MissionRewardListResponseDto extends createZodDto(MissionRewardListResponseSchema) {}
export class ResolveUncertainRewardDto extends createZodDto(resolveUncertainRewardSchema) {}
