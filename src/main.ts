import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc, ZodValidationPipe } from 'nestjs-zod';

import { AppModule } from './app.module';
import { HttpErrorsException } from './shared/exceptions/httpErrors.exception';
import { TypeORMErrorsException } from './shared/exceptions/typeOrmErrors.exception';
import { LoggerService } from './shared/logger/logger.service';

async function bootstrap() {
	const app = await NestFactory.create<NestFastifyApplication>(
		AppModule,
		new FastifyAdapter({ bodyLimit: 10 * 1024 * 1024 }),
	);
	await app.register(cookie);
	await app.register(multipart, {
		limits: { fileSize: 5 * 1024 * 1024, files: 1 },
		attachFieldsToBody: 'keyValues',
		onFile: async part => {
			part.value = {
				buffer: await part.toBuffer(),
				filename: part.filename,
				mimetype: part.mimetype,
			};
		},
	});
	const configService = app.get(ConfigService);

	app.setGlobalPrefix('api/v1.0');

	app.useGlobalFilters(new TypeORMErrorsException());
	app.useGlobalFilters(new HttpErrorsException());
	app.useGlobalPipes(new ZodValidationPipe());
	app.enableCors({
		origin: configService
			.get<string>('CORS_ALLOWED', 'http://localhost:4000')
			.split(', '),
		credentials: true,
	});

	const swaggerConfig = new DocumentBuilder()
		.setTitle('Luckybet Premios API')
		.setDescription('API de LuckyBet Premios')
		.setVersion('1.0')
		.addCookieAuth('accessToken')
		.build();

	const document = SwaggerModule.createDocument(app, swaggerConfig);
	SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document), {
		swaggerOptions: { tryItOutEnabled: true, withCredentials: true },
	});

	const port = configService.get<string>('PORT', '3000');

	await app.listen({ port: Number(port), host: '0.0.0.0' });
	const loggerService = app.get(LoggerService);
	const logger = loggerService.createLogger('app');
	logger.log(`App is ready and listening on port ${port} 🚀`);
}

bootstrap().catch(handleError);

function handleError(error: unknown) {
	// biome-ignore lint/suspicious/noConsole: fatal bootstrap error log
	console.error('FATAL BOOTSTRAP ERROR:', error);
	// eslint-disable-next-line unicorn/no-process-exit
	process.exit(1);
}

process.on('uncaughtException', handleError);
