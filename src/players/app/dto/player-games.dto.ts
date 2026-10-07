import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';

import { apiResponseSchema } from '@/src/shared/swagger/apiResponse.schema';

export const playerPlayedGamesFilterSchema = z.object({
	days: z.coerce
		.number()
		.int()
		.min(1)
		.max(90)
		.optional()
		.describe('Cantidad de días hacia atrás a consultar (por defecto 7)'),
	limit: z.coerce
		.number()
		.int()
		.min(1)
		.max(100)
		.optional()
		.describe('Límite máximo de juegos deduplicados a retornar (por defecto 10)'),
	from: z
		.string()
		.optional()
		.describe('Fecha inicial de búsqueda (YYYY-MM-DD o YYYY-MM-DD HH:MM:SS)'),
	to: z
		.string()
		.optional()
		.describe('Fecha final de búsqueda (YYYY-MM-DD o YYYY-MM-DD HH:MM:SS)'),
	provider: z
		.string()
		.optional()
		.describe('Filtrar juegos por proveedor (ej. Pragmatic Play, NetEnt)'),
	gameName: z.string().optional().describe('Filtrar juegos por nombre o identificador'),
	forceRefresh: z.coerce
		.boolean()
		.optional()
		.describe('Forzar refresco ignorando la memoria caché de Redis'),
});

export type PlayerPlayedGamesFilter = z.infer<typeof playerPlayedGamesFilterSchema>;
export class PlayerPlayedGamesFilterDto extends createZodDto(
	playerPlayedGamesFilterSchema,
) {}

export const playerLastPlayedGameSchema = z.object({
	gameId: z.string().nullable().optional().describe('ID del juego'),
	gameName: z.string().nullable().optional().describe('Nombre del juego'),
	provider: z.string().nullable().optional().describe('Proveedor del juego'),
	imageUrl: z.string().nullable().optional().describe('URL de imagen en CDN'),
	lastPlayedAt: z
		.string()
		.nullable()
		.optional()
		.describe('Fecha/hora de última actividad'),
	isCurrentlyPlaying: z
		.boolean()
		.optional()
		.describe('Indica si el jugador tiene una sesión activa en el juego'),
});

export const playedGameItemSchema = z.object({
	gameId: z.string().describe('ID del juego'),
	gameName: z.string().describe('Nombre del juego'),
	provider: z.string().optional().describe('Proveedor del juego'),
	imageUrl: z.string().optional().describe('URL de imagen en CDN'),
	lastPlayedAt: z.string().describe('Fecha/hora de última actividad'),
	totalWagerInPeriod: z
		.number()
		.optional()
		.describe('Monto total apostado en el período'),
	playCount: z.number().optional().describe('Cantidad de rondas/veces jugadas'),
});

export const playerGameHistorySchema = z.object({
	userId: z.union([z.string(), z.number()]).describe('ID de usuario LuckyBet'),
	periodDays: z.number().describe('Días analizados en el período'),
	from: z.string().describe('Fecha inicial del período'),
	to: z.string().describe('Fecha final del período'),
	totalUniqueGames: z.number().describe('Cantidad total de juegos únicos jugados'),
	games: z.array(playedGameItemSchema).describe('Lista de juegos deduplicados'),
});

export const PlayerLastPlayedGameResponseSchema = apiResponseSchema(
	playerLastPlayedGameSchema,
);
export const PlayerGameHistoryResponseSchema = apiResponseSchema(playerGameHistorySchema);

export class PlayerLastPlayedGameResponseDto extends createZodDto(
	PlayerLastPlayedGameResponseSchema,
) {}
export class PlayerGameHistoryResponseDto extends createZodDto(
	PlayerGameHistoryResponseSchema,
) {}
