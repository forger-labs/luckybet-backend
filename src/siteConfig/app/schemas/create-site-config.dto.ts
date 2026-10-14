import { createZodDto } from 'nestjs-zod';

import { createSiteConfigSchema } from './site-config.schema';

export class CreateSiteConfigDto extends createZodDto(createSiteConfigSchema) {}
