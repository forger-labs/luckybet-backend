import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
	apiResponseSchema,
	paginatedResponseSchema,
} from '../../../shared/swagger/apiResponse.schema';
import { zDateHelper } from '../../../shared/swagger/date.schema';
import { BonusIntern } from '../../../types/bonus';
import { zBooleanQuery } from '@/src/shared/swagger/boolean.schema';

export const validationRoomMessages = {
	name: {
		string: 'El nombre de la sala es obligatorio',
		min: 'Minimo 1 caracter para el nombre de la sala',
		max: 'Maximo 100 caracteres para el nombre de la sala',
	},
	bonus: {
		enum: 'Valores validos de bonus: 0, 30, 40, 50, 100, 150, 200',
	},
};

export const createRoomSchema = z.object({
	name: z
		.string()
		.min(1, validationRoomMessages.name.min)
		.max(100, validationRoomMessages.name.max)
		.describe('Nombre exacto del senior/sala en LuckyBet'),
	bonus: z
		.enum(BonusIntern, validationRoomMessages.bonus.enum)
		.default(BonusIntern.Zero)
		.describe('Bono porcentual que otorga la sala'),
	isActive: z
		.boolean()
		.default(true)
		.describe('Estado activo/inactivo de la sala'),
});

export const updateRoomSchema = createRoomSchema.partial();

export const roomQueryFilterSchema = z.object({
	name: z.string().optional(),
	bonus: z.enum(BonusIntern).optional(),
	isActive: zBooleanQuery.nullable().optional(),
	take: z.coerce.number().int().min(1).default(50).optional(),
	skip: z.coerce.number().int().min(0).default(0).optional(),
});

export const roomBasicSchema = z.object({
	id: z.number().int(),
	name: z.string(),
	bonus: z.enum(BonusIntern),
	isActive: z.boolean(),
	createdAt: zDateHelper.optional(),
	updatedAt: zDateHelper.optional(),
});

export type RoomBasic = {
	id: number;
	name: string;
	bonus: BonusIntern;
	isActive: boolean;
	createdAt?: Date | string;
	updatedAt?: Date | string;
};

export type RoomQueryFilter = z.infer<typeof roomQueryFilterSchema>;

export const RoomResponseSchema = apiResponseSchema(roomBasicSchema);
export const RoomListResponseSchema = paginatedResponseSchema(roomBasicSchema);
export const ActiveRoomsResponseSchema = apiResponseSchema(z.array(roomBasicSchema));

export class CreateRoomDto extends createZodDto(createRoomSchema) {}
export class UpdateRoomDto extends createZodDto(updateRoomSchema) {}
export class RoomQueryFilterDto extends createZodDto(roomQueryFilterSchema) {}
export class RoomResponseDto extends createZodDto(RoomResponseSchema) {}
export class RoomListResponseDto extends createZodDto(RoomListResponseSchema) {}
export class ActiveRoomsResponseDto extends createZodDto(ActiveRoomsResponseSchema) {}
