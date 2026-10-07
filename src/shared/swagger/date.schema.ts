import { z } from 'zod';

/**
 * Helper de Zod para campos de fecha en respuestas REST y Swagger/OpenAPI.
 * En JSON/Swagger viaja como string ISO (date-time).
 * Acepta strings ISO o Date objects convertidos a ISO string.
 */
export const zDateHelper = z.preprocess(val => {
	if (val instanceof Date) return val.toISOString();
	if (typeof val === 'number') return new Date(val).toISOString();
	return val;
}, z.string().describe('Fecha en formato ISO 8601'));
