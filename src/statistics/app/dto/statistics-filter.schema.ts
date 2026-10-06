import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { zDateHelper } from '@/src/shared/swagger/date.schema';

export const dateRangeFilterSchema = z.object({
  startDate: zDateHelper
    .optional()
    .describe(
      'Fecha inicial ISO 8601 (inclusive). Ejemplo: 2026-03-01T00:00:00.000Z',
    ),
  endDate: zDateHelper
    .optional()
    .describe(
      'Fecha final ISO 8601 (inclusive). Ejemplo: 2026-03-31T23:59:59.999Z',
    ),
});

export type DateRangeFilter = z.infer<typeof dateRangeFilterSchema>;
export class DateRangeFilterDto extends createZodDto(dateRangeFilterSchema) {}
