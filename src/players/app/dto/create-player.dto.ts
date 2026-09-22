import { createZodDto } from 'nestjs-zod';

import { createPlayerSchema } from './player.schema';

export class CreatePlayerDto extends createZodDto(createPlayerSchema) {}
