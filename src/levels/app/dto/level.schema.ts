import { createZodDto } from 'nestjs-zod';
import z from 'zod';

import type { UploadableFile } from '@/src/shared/storage/storage.port';
import {
	apiResponseSchema,
	paginatedResponseSchema,
} from '@/src/shared/swagger/apiResponse.schema';

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
		string: 'image es obligatorio como string o archivo multipart',
		buffer: 'El archivo de imagen no es valido',
		filename: 'El archivo de imagen debe tener un nombre',
		mimetype: 'Solo se permiten imagenes JPEG, PNG o WebP',
		size: 'La imagen no puede superar los 5 MiB',
		describe: 'Imagen representativa del nivel (JPEG, PNG o WebP, maximo 5 MiB)',
	},
	coins: {
		number: 'coins debe ser un número entero mayor o igual a 0',
		describe: 'Indica las fichas que se regalan al lograr un nuevo nivel',
	},
	bonuses: {
		enum: 'Solo se aceptan los siguientes valores de bonus: 0, 30, 40, 50, 100, 150, 200',
		describe: 'Indica el bonus que se regala al lograr un nuevo nivel',
	},
	sortOrder: {
		enum: 'sortOrder solo acepta ASC o DESC',
		describe: 'Dirección del ordenamiento (ASC o DESC, por defecto ASC)',
	},
};

export const levelImageSchema = z
	.object({
		buffer: z
			.unknown()
			.refine(
				(value): value is Buffer => value instanceof Buffer,
				validationLevelMessages.image.buffer,
			),
		filename: z.string().min(1, validationLevelMessages.image.filename),
		mimetype: z
			.string()
			.refine(
				value => ['image/jpeg', 'image/png', 'image/webp'].includes(value),
				validationLevelMessages.image.mimetype,
			),
	})
	.refine(
		file => file.buffer.length <= 5 * 1024 * 1024,
		validationLevelMessages.image.size,
	);

export const levelFilterSchema = z.object({
	name: z.string().optional().nullable(),
	minCoins: z.coerce.number().optional().nullable(),
	maxCoins: z.coerce.number().optional().nullable(),
	roomId: z.coerce.number().int().optional().nullable(),
	minExperience: z.coerce.number().optional().nullable(),
	maxExperience: z.coerce.number().optional().nullable(),
	sortOrder: z
		.enum(['ASC', 'DESC', 'asc', 'desc'])
		.default('ASC')
		.optional()
		.nullable()
		.describe(validationLevelMessages.sortOrder.describe),
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
	roomId: z
		.number()
		.int()
		.nullable()
		.optional()
		.describe('ID de la sala asignada al nivel'),
});

export const levelSchemaNoID = levelSchema.omit({ id: true });
export const updateLevelSchema = levelSchemaNoID.partial();

export const createLevelMultipartSchema = z.object({
	name: z
		.string(validationLevelMessages.name.string)
		.min(1, validationLevelMessages.name.min)
		.max(100, validationLevelMessages.name.max)
		.describe(validationLevelMessages.name.describe),
	minExperience: z.coerce
		.number(validationLevelMessages.minExperience.number)
		.int()
		.min(0, validationLevelMessages.minExperience.number)
		.describe(validationLevelMessages.minExperience.describe),
	coins: z.coerce
		.number(validationLevelMessages.coins.number)
		.int()
		.min(0, validationLevelMessages.coins.number)
		.describe(validationLevelMessages.coins.describe),
	roomId: z.coerce
		.number()
		.int()
		.nullable()
		.optional()
		.describe('ID de la sala asignada al nivel'),
	image: levelImageSchema,
});

export const updateLevelMultipartSchema = z.object({
	name: z
		.string(validationLevelMessages.name.string)
		.min(1, validationLevelMessages.name.min)
		.max(100, validationLevelMessages.name.max)
		.optional()
		.describe(validationLevelMessages.name.describe),
	minExperience: z.coerce
		.number(validationLevelMessages.minExperience.number)
		.int()
		.min(0, validationLevelMessages.minExperience.number)
		.optional()
		.describe(validationLevelMessages.minExperience.describe),
	coins: z.coerce
		.number(validationLevelMessages.coins.number)
		.int()
		.min(0, validationLevelMessages.coins.number)
		.optional()
		.describe(validationLevelMessages.coins.describe),
	roomId: z.coerce
		.number()
		.int()
		.nullable()
		.optional()
		.describe('ID de la sala asignada al nivel'),
	image: levelImageSchema.optional(),
});

export type LevelType = z.infer<typeof levelSchema>;
export type CreateLevelType = z.infer<typeof levelSchemaNoID>;
export type UpdateLevelType = z.infer<typeof updateLevelSchema>;

export type CreateLevelMultipart = {
	name: string;
	minExperience: number;
	coins: number;
	roomId?: number | null;
	image: UploadableFile;
};

export type UpdateLevelMultipart = {
	name?: string;
	minExperience?: number;
	coins?: number;
	roomId?: number | null;
	image?: UploadableFile;
};

export class LevelDTO extends createZodDto(levelSchema) {}
export class CreateLevelDto extends createZodDto(levelSchemaNoID) {}
export class UpdateLevelDto extends createZodDto(updateLevelSchema) {}
export class CreateLevelMultipartDto extends createZodDto(createLevelMultipartSchema) {}
export class UpdateLevelMultipartDto extends createZodDto(updateLevelMultipartSchema) {}

export const ResponseLevelSchema = apiResponseSchema(levelSchema);
export const ResponseListLevelSchema = paginatedResponseSchema(levelSchema);

export class LevelResponseDto extends createZodDto(ResponseLevelSchema) {}
export class LevelListResponseDto extends createZodDto(ResponseListLevelSchema) {}
