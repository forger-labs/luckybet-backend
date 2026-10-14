import { createZodDto } from 'nestjs-zod';

import { updateSiteConfigSchema } from './site-config.schema';

export class UpdateSiteConfigDto extends createZodDto(updateSiteConfigSchema) {}
