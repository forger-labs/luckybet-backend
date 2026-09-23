import {
	CallHandler,
	ExecutionContext,
	Injectable,
	Logger,
	NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { LoggerService } from '../logger/logger.service';

interface FastifyRequest {
	method: string;
	url: string;
	body?: Record<string, unknown>;
}

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
	private readonly logger: Logger;

	constructor(loggerService: LoggerService) {
		this.logger = loggerService.createLogger('HTTP');
	}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const http = context.switchToHttp();
		const request = http.getRequest<FastifyRequest>();
		const { method, url } = request;

		const now = Date.now();

		return next.handle().pipe(
			tap(() => {
				const response = http.getResponse<{ statusCode: number }>();
				this.logger.log(
					`${method} ${url} ${response.statusCode} - ${Date.now() - now}ms`,
				);

				// if (body && Object.keys(body).length > 0) {
				// 	this.logger.log(`Request Body: ${JSON.stringify(body, null, 2)}`);
				// }
			}),
		);
	}
}
