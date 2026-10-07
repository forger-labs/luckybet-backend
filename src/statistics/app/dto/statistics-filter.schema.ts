import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { zDateHelper } from '@/src/shared/swagger/date.schema';

export const dateRangeFilterSchema = z.object({
	startDate: zDateHelper
		.optional()
		.describe(
			'Fecha/Hora inicial (inclusive) en huso horario Argentina. Ejemplo: 2026-03-01T00:00:00.000Z, 2026-03-01 o 2026-03-01 14:00:00',
		),
	endDate: zDateHelper
		.optional()
		.describe(
			'Fecha/Hora final (inclusive) en huso horario Argentina. Ejemplo: 2026-03-31T23:59:59.999Z, 2026-03-31 o 2026-03-31 18:00:00',
		),
});

export type DateRangeFilter = z.infer<typeof dateRangeFilterSchema>;
export class DateRangeFilterDto extends createZodDto(dateRangeFilterSchema) {}
