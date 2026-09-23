import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';

import {
	PlayerTokenGuard,
	type RequestWithPlayer,
} from '../app/guards/playerToken.guard';
import type { ForPanelApiCore } from '../ports/forPanelApiCore.port';
import type { PlayerAuthContext } from '../types/panelApiCore.types';

describe('PlayerTokenGuard', () => {
	let guard: PlayerTokenGuard;
	let panelCoreMock: jest.Mocked<ForPanelApiCore>;

	beforeEach(() => {
		panelCoreMock = {
			authenticatePlayer: jest.fn(),
			syncOrRegisterPlayer: jest.fn(),
			invalidatePlayerSession: jest.fn(),
			hashToken: jest.fn(),
			creditPlayer: jest.fn(),
			debitPlayer: jest.fn(),
			getLastPlayedGames: jest.fn(),
		};

		guard = new PlayerTokenGuard(panelCoreMock);
	});

	const createMockExecutionContext = (
		request: Partial<RequestWithPlayer>,
	): ExecutionContext => {
		return {
			switchToHttp: () => ({
				getRequest: () => request as RequestWithPlayer,
			}),
		} as unknown as ExecutionContext;
	};

	it('should throw UnauthorizedException if no token is provided in request', async () => {
		const context = createMockExecutionContext({
			headers: {},
		});

		await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
		expect(panelCoreMock.authenticatePlayer).not.toHaveBeenCalled();
	});

	it('should extract Bearer token from Authorization header and inject player context', async () => {
		const mockPlayer: PlayerAuthContext = {
			id: 1,
			username: 'pepe',
			isActive: true,
			cash: 1000,
			currency: 'ARS',
		};

		panelCoreMock.authenticatePlayer.mockResolvedValueOnce(mockPlayer);

		const request: Partial<RequestWithPlayer> = {
			headers: {
				authorization: 'Bearer valid-jwt-token-123',
			},
		};
		const context = createMockExecutionContext(request);

		const canActivate = await guard.canActivate(context);

		expect(canActivate).toBe(true);
		expect(panelCoreMock.authenticatePlayer).toHaveBeenCalledWith('valid-jwt-token-123');
		expect(request.player).toEqual(mockPlayer);
	});

	it('should extract token from x-player-token header', async () => {
		const mockPlayer: PlayerAuthContext = {
			id: 2,
			username: 'maria',
			isActive: true,
			cash: 500,
		};
		panelCoreMock.authenticatePlayer.mockResolvedValueOnce(mockPlayer);

		const request: Partial<RequestWithPlayer> = {
			headers: {
				'x-player-token': 'custom-player-token-456',
			},
		};
		const context = createMockExecutionContext(request);

		const canActivate = await guard.canActivate(context);

		expect(canActivate).toBe(true);
		expect(panelCoreMock.authenticatePlayer).toHaveBeenCalledWith(
			'custom-player-token-456',
		);
		expect(request.player).toEqual(mockPlayer);
	});

	it('should extract token from query parameters as fallback', async () => {
		const mockPlayer: PlayerAuthContext = {
			id: 3,
			username: 'juan',
			isActive: true,
		};
		panelCoreMock.authenticatePlayer.mockResolvedValueOnce(mockPlayer);

		const request: Partial<RequestWithPlayer> = {
			headers: {},
			query: {
				token: 'query-token-789',
			},
		};
		const context = createMockExecutionContext(request);

		const canActivate = await guard.canActivate(context);

		expect(canActivate).toBe(true);
		expect(panelCoreMock.authenticatePlayer).toHaveBeenCalledWith('query-token-789');
		expect(request.player).toEqual(mockPlayer);
	});

	it('should propagate UnauthorizedException when panelCore fails authentication', async () => {
		panelCoreMock.authenticatePlayer.mockRejectedValueOnce(
			new UnauthorizedException('Token expirado'),
		);

		const request: Partial<RequestWithPlayer> = {
			headers: {
				authorization: 'Bearer expired-token',
			},
		};
		const context = createMockExecutionContext(request);

		await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
	});
});
