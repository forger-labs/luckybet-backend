import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
	handleRequest<T>(err: Error | null, user: T): T {
		if (err || !user) {
			throw (
				err ?? new UnauthorizedException('No se pudo verificar el token de autenticacion')
			);
		}
		return user;
	}
}
