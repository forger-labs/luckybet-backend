import { createZodDto } from 'nestjs-zod';
import z from 'zod';

import {
	apiResponseSchema,
	paginatedResponseSchema,
} from '@/src/shared/swagger/apiResponse.schema';
import { BonusIntern } from '@/src/types/bonus';

export const validationLevelMessages = {
	name: {
		string: 'name es obligatorio como string',
		min: 'Minimo 1 caracter para el name',
		max: 'Maximo 100 caracteres para el name',
		describe: 'Nombre del nivel',
	},
	minExperience: {
		number: 'minExperience debe ser un número entero mayor o igual a 0',
		describe: 'Minimo de experiencia del nivel',
	},
	image: {
		string: 'image es obligatorio como string',
		describe: 'Imagen representativa del nivel',
	},
	coins: {
		number: 'coins debe ser un número entero mayor o igual a 0',
		describe: 'Indica las fichas que se regalan al lograr un nuevo nivel',
	},
	bonuses: {
		enum: 'Solo se aceptan los siguientes valores de bonus: 0, 30, 40, 50, 100, 150, 200',
		describe: 'Indica el bonus que se regala al lograr un nuevo nivel',
	},
};

export const levelFilterSchema = z.object({
	name: z.string().optional().nullable(),
	minCoins: z.coerce.number().optional().nullable(),
	maxCoins: z.coerce.number().optional().nullable(),
	bonus: z.enum(BonusIntern).optional().nullable(),
	minExperience: z.coerce.number().optional().nullable(),
	maxExperience: z.coerce.number().optional().nullable(),
});

export type LevelsFilter = z.infer<typeof levelFilterSchema>;
export class LevelFilterDto extends createZodDto(levelFilterSchema) {}

export const levelSchema = z.object({
	id: z.number().describe('Level ID'),
	name: z
		.string()
		.min(1, validationLevelMessages.name.min)
		.max(100, validationLevelMessages.name.max)
		.describe(validationLevelMessages.name.describe),
	image: z
		.string()
		.min(1, validationLevelMessages.image.string)
		.max(500)
		.describe(validationLevelMessages.image.describe),
	minExperience: z
		.number()
		.int()
		.min(0, validationLevelMessages.minExperience.number)
		.describe(validationLevelMessages.minExperience.describe),
	coins: z
		.number()
		.int()
		.min(0, validationLevelMessages.coins.number)
		.describe(validationLevelMessages.coins.describe),
	bonus: z
		.enum(BonusIntern)
		.nullable()
		.optional()
		.describe(validationLevelMessages.bonuses.describe),
});

export const levelSchemaNoID = levelSchema.omit({ id: true });
export const updateLevelSchema = levelSchemaNoID.partial();

export type LevelType = z.infer<typeof levelSchema>;
export type CreateLevelType = z.infer<typeof levelSchemaNoID>;
export type UpdateLevelType = z.infer<typeof updateLevelSchema>;

export class LevelDTO extends createZodDto(levelSchema) {}
export class CreateLevelDto extends createZodDto(levelSchemaNoID) {}
export class UpdateLevelDto extends createZodDto(updateLevelSchema) {}

export const ResponseLevelSchema = apiResponseSchema(levelSchema);
export const ResponseListLevelSchema = paginatedResponseSchema(levelSchema);

export class LevelResponseDto extends createZodDto(ResponseLevelSchema) {}
export class LevelListResponseDto extends createZodDto(ResponseListLevelSchema) {}
