import { Test, type TestingModule } from '@nestjs/testing';
import type { FastifyRequest } from 'fastify';

import { FOR_PANEL_API_CORE } from '@/src/panelApi/constants';
import type { PlayerGameHistoryResult } from '@/src/panelApi/types/adminPanel.types';
import type { PlayerAuthContext } from '@/src/panelApi/types/panelApiCore.types';
import type { PlayerLastPlayedGameResult } from '@/src/panelApi/types/userPanel.types';
import { PLAYER_CORE_PROVIDER } from '../../app/constants';
import type { PlayerResponse } from '../../app/dto/player.schema';
import type { ForManagePlayers } from '../../ports/driven/ForManagePlayers';
import { PlayersController } from './players.controller';

describe('PlayersController', () => {
	let controller: PlayersController;
	let coreMock: jest.Mocked<ForManagePlayers>;

	const mockPlayer: PlayerResponse = {
		id: 1,
		username: 'testplayer',
		phone: '12345678',
		isActive: true,
		experience: 0,
		levelId: 1,
		level: {
			id: 1,
			name: 'Nivel 1',
			image: 'img.png',
			minExperience: 0,
		},
	};

	const mockAuthContext: PlayerAuthContext = {
		id: 1,
		username: 'testplayer',
		phone: '12345678',
		isActive: true,
		levelId: 1,
		cash: 2500,
		currency: 'ARS',
		luckyBetId: '8744343',
	};

	beforeEach(async () => {
		coreMock = {
			createPlayer: jest.fn(),
			findById: jest.fn(),
			getPlayers: jest.fn(),
			updatePlayerById: jest.fn(),
			getLastPlayedGame: jest.fn(),
			getPlayedGames: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [PlayersController],
			providers: [
				{
					provide: PLAYER_CORE_PROVIDER,
					useValue: coreMock,
				},
				{
					provide: FOR_PANEL_API_CORE,
					useValue: {},
				},
			],
		}).compile();

		controller = module.get<PlayersController>(PlayersController);
	});

	describe('create', () => {
		it('should create player and return standard response', async () => {
			coreMock.createPlayer.mockResolvedValueOnce(mockPlayer);

			const result = await controller.create({
				username: 'testplayer',
				phone: '12345678',
				isActive: true,
			});

			expect(result.status).toBe(true);
			expect(result.data).toEqual(mockPlayer);
			expect(result.message).toBe('Player created successfully');
		});
	});

	describe('findAll', () => {
		it('should return paginated players', async () => {
			coreMock.getPlayers.mockResolvedValueOnce({
				players: [mockPlayer],
				total: 1,
				limit: 10,
				skip: 0,
			});

			const result = await controller.findAll(10, 0);

			expect(result.status).toBe(true);
			expect(result.data).toHaveLength(1);
			expect(result.meta.total).toBe(1);
		});
	});

	describe('me', () => {
		it('should return current authenticated player context', () => {
			const result = controller.me(mockAuthContext);

			expect(result.status).toBe(true);
			expect(result.data).toEqual(mockAuthContext);
		});
	});

	describe('getLastGame', () => {
		it('should extract token from Bearer header and return last played game', async () => {
			const mockLastGame: PlayerLastPlayedGameResult = {
				gameId: 'sweet_bonanza',
				gameName: 'Sweet Bonanza 1000',
				provider: 'Pragmatic Play',
				imageUrl: 'https://cdn.cdnpin.com/resources/sweet.png',
				lastPlayedAt: '2026-09-21 15:00:00',
				isCurrentlyPlaying: true,
			};

			coreMock.getLastPlayedGame.mockResolvedValueOnce(mockLastGame);

			const mockReq = {
				headers: {
					authorization: 'Bearer token-abc-123',
				},
			} as unknown as FastifyRequest;

			const result = await controller.getLastGame(mockAuthContext, mockReq);

			expect(result.status).toBe(true);
			expect(result.data).toEqual(mockLastGame);
			expect(result.message).toBe('Último juego obtenido exitosamente');
			expect(coreMock.getLastPlayedGame).toHaveBeenCalledWith('token-abc-123');
		});

		it('should extract token from x-player-token header if no Bearer header', async () => {
			const mockLastGame: PlayerLastPlayedGameResult = {
				gameId: 'gates_of_olympus',
				gameName: 'Gates of Olympus',
				isCurrentlyPlaying: false,
			};

			coreMock.getLastPlayedGame.mockResolvedValueOnce(mockLastGame);

			const mockReq = {
				headers: {
					'x-player-token': 'custom-player-token',
				},
			} as unknown as FastifyRequest;

			const result = await controller.getLastGame(mockAuthContext, mockReq);

			expect(result.status).toBe(true);
			expect(coreMock.getLastPlayedGame).toHaveBeenCalledWith('custom-player-token');
		});
	});

	describe('getGames', () => {
		it('should return filtered played games history for current player', async () => {
			const mockHistory: PlayerGameHistoryResult = {
				userId: '8744343',
				periodDays: 7,
				from: '2026-09-14 00:00:00',
				to: '2026-09-21 23:59:59',
				totalUniqueGames: 1,
				games: [
					{
						gameId: 'sweet_bonanza',
						gameName: 'Sweet Bonanza 1000',
						provider: 'Pragmatic Play',
						imageUrl: 'https://cdn.cdnpin.com/resources/sweet.png',
						lastPlayedAt: '2026-09-21 14:00:00',
					},
				],
			};

			coreMock.getPlayedGames.mockResolvedValueOnce(mockHistory);

			const mockReq = {
				headers: {
					authorization: 'Bearer user-token',
				},
			} as unknown as FastifyRequest;

			const result = await controller.getGames(
				mockAuthContext,
				{
					days: 7,
					limit: 10,
					provider: 'Pragmatic Play',
				},
				mockReq,
			);

			expect(result.status).toBe(true);
			expect(result.data).toEqual(mockHistory);
			expect(result.message).toBe('Historial de juegos obtenido exitosamente');
			expect(coreMock.getPlayedGames).toHaveBeenCalledWith(
				mockAuthContext,
				expect.objectContaining({
					days: 7,
					limit: 10,
					provider: 'Pragmatic Play',
					token: 'user-token',
				}),
			);
		});
	});

	describe('findOne', () => {
		it('should return player by id', async () => {
			coreMock.findById.mockResolvedValueOnce(mockPlayer);

			const result = await controller.findOne(1);

			expect(result.status).toBe(true);
			expect(result.data).toEqual(mockPlayer);
			expect(result.message).toBe('Player obtenido exitosamente');
		});
	});

	describe('update', () => {
		it('should update player by id', async () => {
			const updated = { ...mockPlayer, phone: '999999' };
			coreMock.updatePlayerById.mockResolvedValueOnce(updated);

			const result = await controller.update(1, { phone: '999999' });

			expect(result.status).toBe(true);
			expect(result.data?.phone).toBe('999999');
			expect(result.message).toBe('Player editado exitosamente');
		});
	});
});
