import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';

import { validationPlayerMessages } from './player.schema';

export const playerSchemaOptional = z.object({
	username: z
		.string(validationPlayerMessages.username.string)
		.min(1, validationPlayerMessages.username.min)
		.max(100, validationPlayerMessages.username.max)
		.optional()
		.describe(validationPlayerMessages.username.describe),
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
