import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';

import { MissionStatus, MissionType } from '../enums';
import { validationMissionMessages } from './mission.schema';

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
	bonus: z
		.number(validationMissionMessages.bonus.int)
		.int()
		.min(0, validationMissionMessages.bonus.min)
		.optional()
		.describe(validationMissionMessages.bonus.describe),
	experiencePoints: z
		.number(validationMissionMessages.experiencePoints.int)
		.int()
		.min(0, validationMissionMessages.experiencePoints.min)
		.optional()
		.describe(validationMissionMessages.experiencePoints.describe),
	imageUrl: z
		.url(validationMissionMessages.imageUrl.url)
		.max(500, validationMissionMessages.imageUrl.max)
		.optional()
		.describe(validationMissionMessages.imageUrl.describe),
});

export class UpdateMissionDto extends createZodDto(updateMissionSchema) {}
