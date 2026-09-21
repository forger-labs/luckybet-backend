import { createZodDto } from 'nestjs-zod';

import {
createLevelSchemaMultipart
} from './level.schema';


export class CreateLevelMultipartDto extends createZodDto(
	createLevelSchemaMultipart,
) {}
