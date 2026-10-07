import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';

import { validationLevelMessages } from '@/src/levels/app/dto/level.schema';
import {
	apiResponseSchema,
	paginatedResponseSchema,
} from '../../../shared/swagger/apiResponse.schema';
import { zBooleanQuery } from '../../../shared/swagger/boolean.schema';

export const validationPlayerMessages = {
	username: {
		string: 'username es obligatorio como string',
		min: 'Minimo 1 caracter para el username',
		max: 'Maximo 100 caracteres para el username',
		describe: 'Nombre de usuario del jugador',
	},
	phone: {
		string: 'phone debe ser string',
		max: 'Maximo 20 caracteres para el teléfono',
		describe: 'Número de teléfono del jugador',
	},
	isActive: {
		boolean: 'Solo se aceptan valores booleanos',
		describe: 'Indica si el jugador está activo',
	},
	levelID: {
		number: 'Solo se aceptan valores numericos',
		describe: 'Indica el ID del nivel',
	},
	experience: {
		number: 'Solo se aceptan valores numericos',
		describe: 'Indica la cantidad de experiencia del jugador',
	},
};

export enum SortOrder {
	ASC = 'ASC',
	DESC = 'DESC',
}

export const playerSchema = z.object({
	id: z.number().optional().describe('ID del jugador'),
	username: z
		.string()
		.min(1, validationPlayerMessages.username.min)
		.max(100, validationPlayerMessages.username.max)
		.describe(validationPlayerMessages.username.describe),
	phone: z
		.string()
		.max(20, validationPlayerMessages.phone.max)
		.nullable()
		.optional()
		.describe(validationPlayerMessages.phone.describe),
	isActive: z
		.boolean()
		.default(true)
		.describe(validationPlayerMessages.isActive.describe),
	levelId: z
		.number()
		.optional()
		.nullable()
		.describe(validationPlayerMessages.levelID.describe),
	experience: z
		.number()
		.default(0)
		.describe(validationPlayerMessages.experience.describe),
	level: z
		.object({
			id: z.number().optional(),
			name: z.string().describe(validationLevelMessages.name.describe),
			image: z.string().describe(validationLevelMessages.image.describe),
			minExperience: z.number().describe(validationLevelMessages.minExperience.describe),
		})
		.optional()
		.nullable(),
	roomId: z.number().int().optional().nullable().describe('ID de la sala asignada'),
	room: z
		.object({
			id: z.number().int(),
			name: z.string(),
			bonus: z.string(),
			isActive: z.boolean(),
		})
		.optional()
		.nullable(),
});

export const createPlayerSchema = playerSchema.omit({
	level: true,
	id: true,
	experience: true,
	room: true,
});

export const playerFilterSchema = z.object({
	username: z.string().optional().describe('Búsqueda parcial por username'),
	phone: z.string().optional().describe('Búsqueda parcial por teléfono'),
	levelId: z.coerce.number().int().positive().optional().describe('Filtrar por nivel'),
	minExperience: z.coerce
		.number()
		.int()
		.min(0)
		.optional()
		.describe('Experiencia mínima (>=)'),
	maxExperience: z.coerce
		.number()
		.int()
		.min(0)
		.optional()
		.describe('Experiencia máxima (<=)'),
	roomId: z.coerce
		.number()
		.int()
		.positive()
		.optional()
		.describe('Filtrar por ID de sala'),
	isActive: zBooleanQuery.optional().describe('Filtrar por estado activo/inactivo'),
	orderDirection: z
		.enum(SortOrder)
		.default(SortOrder.DESC)
		.optional()
		.describe('Orden por fecha de creación (ASC o DESC, por defecto DESC)'),
	take: z.coerce
		.number()
		.int()
		.positive()
		.max(100)
		.default(50)
		.describe('Cantidad de registros'),
	skip: z.coerce.number().int().min(0).default(0).describe('Paginación / Offset'),
});

export type Player = z.infer<typeof playerSchema>;
export type PlayerFilter = z.infer<typeof playerFilterSchema>;

export type PlayerCreateResponse = Required<
	Omit<Player, 'id' | 'level' | 'levelId' | 'roomId' | 'room'>
> & {
	id: number;
	levelId?: number | null;
	level?: {
		id?: number;
		name: string;
		image: string;
		minExperience: number;
	} | null;
	roomId?: number | null;
	room?: {
		id: number;
		name: string;
		bonus: string;
		isActive: boolean;
	} | null;
};

export type PlayerResponse = Required<
	Omit<Player, 'id' | 'level' | 'levelId' | 'roomId' | 'room'>
> & {
	id: number;
	levelId?: number | null;
	level?: {
		id?: number;
		name: string;
		image: string;
		minExperience: number;
	} | null;
	roomId?: number | null;
	room?: {
		id: number;
		name: string;
		bonus: string;
		isActive: boolean;
	} | null;
};

export type PlayerWithoutAudit = PlayerResponse;

export type PlayerUniqueFields = Partial<Pick<Player, 'id' | 'username'>>;

export const PlayerResponseSchema = apiResponseSchema(playerSchema);
export const PlayerListResponseSchema = paginatedResponseSchema(playerSchema);

export class PlayerListResponseDto extends createZodDto(PlayerListResponseSchema) {}
export class PlayerResponseDto extends createZodDto(PlayerResponseSchema) {}
export class PlayerFilterDto extends createZodDto(playerFilterSchema) {}
