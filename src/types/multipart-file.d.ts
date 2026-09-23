// src/types/multipart-file.d.ts
import type { MultipartFile } from '@fastify/multipart';

declare module '@fastify/multipart' {
	interface MultipartFile {
		/**
		 * Custom value attached by the global onFile hook so the part can
		 * be read from req.body as { buffer, filename, mimetype }.
		 */
		value?: { buffer: Buffer; filename: string; mimetype: string };
	}
}

export type { MultipartFile };
