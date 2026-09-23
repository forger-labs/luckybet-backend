import {
	type CanActivate,
	type ExecutionContext,
	Inject,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { FOR_PANEL_API_CORE } from '../../constants';
import type { ForPanelApiCore } from '../../ports/forPanelApiCore.port';
import type { PlayerAuthContext } from '../../types/panelApiCore.types';

export interface RequestWithPlayer extends FastifyRequest {
  player?: PlayerAuthContext;
  token?: string;
}

@Injectable()
export class PlayerTokenGuard implements CanActivate {
	constructor(
		@Inject(FOR_PANEL_API_CORE)
		private readonly panelCore: ForPanelApiCore,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<RequestWithPlayer>();
		const token = this.extractToken(request);

		if (!token) {
			throw new UnauthorizedException(
				'Token de autenticación de jugador no proporcionado',
			);
		}

		const authContext = await this.panelCore.authenticatePlayer(token);

		request.player = authContext;
		request.token = token
		return true;
	}

	private extractToken(request: RequestWithPlayer): string | null {
		const authHeader = request.headers?.authorization;
		if (authHeader && typeof authHeader === 'string') {
			const [scheme, token] = authHeader.split(' ');
			if (scheme?.toLowerCase() === 'bearer' && token) {
				return token.trim();
			}
			if (token) {
				return token.trim();
			}
			return authHeader.trim();
		}

		const playerTokenHeader = request.headers?.['x-player-token'];
		if (playerTokenHeader && typeof playerTokenHeader === 'string') {
			return playerTokenHeader.trim();
		}

		const queryToken = (request.query as Record<string, unknown>)?.token;
		if (queryToken && typeof queryToken === 'string') {
			return queryToken.trim();
		}

		return null;
	}
}
