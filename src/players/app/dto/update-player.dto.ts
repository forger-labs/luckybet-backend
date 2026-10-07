import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';

import { validationPlayerMessages } from './player.schema';

export const playerSchemaOptional = z.object({
	phone: z
		.string(validationPlayerMessages.phone.string)
		.max(20, validationPlayerMessages.phone.max)
		.nullable()
		.optional()
		.describe(validationPlayerMessages.phone.describe),
	isActive: z
		.boolean(validationPlayerMessages.isActive.boolean)
		.optional()
		.describe(validationPlayerMessages.isActive.describe),
});

export class UpdatePlayerDto extends createZodDto(playerSchemaOptional) {}
