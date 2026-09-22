import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { PlayerAuthContext } from '../../types/panelApiCore.types';
import type { RequestWithPlayer } from '../guards/playerToken.guard';

export const CurrentPlayer = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): PlayerAuthContext | null => {
		const request = ctx.switchToHttp().getRequest<RequestWithPlayer>();
		return request.player ?? null;
	},
);
