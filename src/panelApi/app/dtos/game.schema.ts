import { createZodDto } from 'nestjs-zod';
import z from 'zod';

import {
  apiResponseSchema,
  paginatedResponseSchema,
} from '@/src/shared/swagger/apiResponse.schema';

export const LuckyBetGameItemSchema = z.looseObject({
  id: z.union([z.number(), z.string()]),
  name: z.string().optional(),
  title: z.string().optional(),
  img: z.string().optional(),
  provider: z.string().optional(),
  category: z.string().optional(),
  type: z.string().optional(),
});

export type LuckyBetGameItem = z.infer<typeof LuckyBetGameItemSchema>;

export class LuckyBetGameItemDTO extends createZodDto(LuckyBetGameItemSchema) {}

export const LuckyBetGameItemResponseSchema = apiResponseSchema(
  LuckyBetGameItemSchema,
);
export const LuckyBetGameItemResponsePaginatedSchema = paginatedResponseSchema(
  LuckyBetGameItemSchema,
);

export class LuckyBetGameItemResponseDTO extends createZodDto(
  LuckyBetGameItemResponseSchema,
) {}
export class LuckyBetGameItemResponsePaginatedDto extends createZodDto(
  LuckyBetGameItemResponsePaginatedSchema,
) {}
