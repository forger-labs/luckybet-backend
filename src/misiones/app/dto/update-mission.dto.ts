import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';

import { MissionStatus, MissionType } from '../enums';
import { createMissionStepSchema, validationMissionMessages } from './mission.schema';

export const updateMissionSchema = z.object({
	title: z
		.string(validationMissionMessages.title.string)
		.min(1, validationMissionMessages.title.min)
		.max(200, validationMissionMessages.title.max)
		.optional()
		.describe(validationMissionMessages.title.describe),
	description: z
		.string()
		.optional()
		.describe(validationMissionMessages.description.describe),
	type: z
		.enum(MissionType, validationMissionMessages.type.enum)
		.optional()
		.describe(validationMissionMessages.type.describe),
	status: z
		.enum(MissionStatus, validationMissionMessages.status.enum)
		.optional()
		.describe(validationMissionMessages.status.describe),
	coinsAmount: z
		.number(validationMissionMessages.coinsAmount.int)
		.int()
		.min(0, validationMissionMessages.coinsAmount.min)
		.optional()
		.describe(validationMissionMessages.coinsAmount.describe),
	roomId: z.coerce
		.number()
		.int()
		.optional()
		.nullable()
		.describe('ID de la sala con bono'),
	experiencePoints: z
		.number(validationMissionMessages.experiencePoints.int)
		.int()
		.min(0, validationMissionMessages.experiencePoints.min)
		.optional()
		.describe(validationMissionMessages.experiencePoints.describe),
	missionSteps: z
		.array(createMissionStepSchema)
		.max(50, validationMissionMessages.missionSteps.max)
		.optional()
		.describe(validationMissionMessages.missionSteps.describe),
});

export class UpdateMissionDto extends createZodDto(updateMissionSchema) {}
