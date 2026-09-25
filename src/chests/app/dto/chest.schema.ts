import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { zBooleanQuery } from '@/src/shared/swagger/boolean.schema';
import {
	apiResponseSchema,
	paginatedResponseSchema,
} from '../../../shared/swagger/apiResponse.schema';
import { ChestPeriodType } from '../enums';

export const validationChestMessages = {
	title: {
		string: 'El titulo es obligatorio como string',
		min: 'Minimo 1 caracter para el titulo',
		max: 'Maximo 200 caracteres para el titulo',
	},
	periodType: {
		enum: 'Valores validos: WEEKLY, MONTHLY',
	},
	requiredMissions: {
		int: 'requiredMissions debe ser un numero entero',
		min: 'Minimo 1 mision requerida',
	},
	coinsAmount: {
		int: 'coinsAmount debe ser un numero entero',
		min: 'Minimo 0 fichas',
	},
	bonus: {
		enum: 'Valores validos de bonus: 0, 30, 40, 50, 100, 150, 200',
	},
	experiencePoints: {
		int: 'experiencePoints debe ser un numero entero',
		min: 'Minimo 0 puntos de experiencia',
	},
	image: {
		buffer: 'El archivo debe ser un buffer valido',
		filename: 'El archivo debe tener un nombre',
		mimetype: 'Solo se permiten imagenes JPEG o PNG',
		size: 'La imagen no puede superar los 5 MiB',
	},
};

export const chestImageSchema = z
	.object({
		buffer: z
			.unknown()
			.refine(
				(value): value is Buffer => value instanceof Buffer,
				validationChestMessages.image.buffer,
			),
		filename: z.string().min(1, validationChestMessages.image.filename),
		mimetype: z
			.string()
			.refine(
				value => ['image/jpeg', 'image/png'].includes(value),
				validationChestMessages.image.mimetype,
			),
	})
	.refine(
		file => file.buffer.length <= 5 * 1024 * 1024,
		validationChestMessages.image.size,
	);

export const createChestSchema = z.object({
	title: z
		.string()
		.min(1, validationChestMessages.title.min)
		.max(200, validationChestMessages.title.max),
	description: z.string().optional(),
	periodType: z.enum(ChestPeriodType, validationChestMessages.periodType.enum),
	requiredMissions: z.coerce
		.number()
		.int()
		.min(1, validationChestMessages.requiredMissions.min),
	coinsAmount: z.coerce.number().int().min(0, validationChestMessages.coinsAmount.min),
	roomId: z.coerce.number().int().optional().nullable(),
	experiencePoints: z.coerce
		.number()
		.int()
		.min(0, validationChestMessages.experiencePoints.min),
	isActive: zBooleanQuery.default(true),
	image: chestImageSchema.optional(),
});

export const updateChestSchema = createChestSchema.partial().omit({ image: true });

export type ChestBasic = {
	id: number;
	title: string;
	description?: string | null;
	periodType: ChestPeriodType;
	requiredMissions: number;
	coinsAmount: number;
	roomId?: number | null;
	experiencePoints: number;
	imageUrl?: string | null;
	isActive: boolean;
	createdAt?: Date;
	updatedAt?: Date;
};

export const chestBasicSchema = z.object({
	id: z.number().int(),
	title: z.string(),
	description: z.string().nullable().optional(),
	periodType: z.enum(ChestPeriodType),
	requiredMissions: z.number().int(),
	coinsAmount: z.number().int(),
	roomId: z.number().int().nullable().optional(),
	experiencePoints: z.number().int(),
	imageUrl: z.string().nullable().optional(),
	isActive: z.boolean(),
});

export const ChestResponseSchema = apiResponseSchema(chestBasicSchema);
export const ChestListResponseSchema = paginatedResponseSchema(chestBasicSchema);

export class CreateChestDto extends createZodDto(createChestSchema) {}
export class UpdateChestDto extends createZodDto(updateChestSchema) {}
export class ChestResponseDto extends createZodDto(ChestResponseSchema) {}
export class ChestListResponseDto extends createZodDto(ChestListResponseSchema) {}
