import { createZodDto } from 'nestjs-zod';

import {
	createMissionMultipartSchema,
	createMissionSchema,
	submitStepMultipartSchema,
} from './mission.schema';

export class CreateMissionDto extends createZodDto(createMissionSchema) {}

export class CreateMissionMultipartDto extends createZodDto(
	createMissionMultipartSchema,
) {}

export class SubmitStepMultipartDto extends createZodDto(submitStepMultipartSchema) {}
