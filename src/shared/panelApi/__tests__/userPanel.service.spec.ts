import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { CACHE_PORT } from '../../cache/constants';
import { UserPanelService } from '../adapters/userPanel.service';
import { AXIOS_USER_PANEL, LUCKYBET_GAME_CATALOG_CACHE_KEY } from '../constants';

describe('UserPanelService', () => {
	let service: UserPanelService;
	let mockAxios: {
		post: jest.Mock;
	};
	let mockCache: {
		get: jest.Mock;
		set: jest.Mock;
		del: jest.Mock;
		exists: jest.Mock;
		ttl: jest.Mock;
	};
	let mockConfig: {
		get: jest.Mock;
	};

	beforeEach(async () => {
		mockAxios = {
			post: jest.fn(),
		};

		mockCache = {
			get: jest.fn(),
			set: jest.fn(),
			del: jest.fn(),
			exists: jest.fn(),
			ttl: jest.fn(),
		};

		mockConfig = {
			get: jest.fn((key: string, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					LUCKYBET_API_BASE: 'https://api.luckybet.site',
					LUCKYBET_DOMAIN: 'luckybet.site',
					LUCKYBET_API_VERSION: 9,
					LUCKYBET_GAME_ACTIVITY_TTL_SECONDS: 300,
					LUCKYBET_GAME_CATALOG_TTL_SECONDS: 3600,
				};
				return values[key] ?? defaultValue;
			}),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				UserPanelService,
				{ provide: ConfigService, useValue: mockConfig },
				{ provide: CACHE_PORT, useValue: mockCache },
				{ provide: AXIOS_USER_PANEL, useValue: mockAxios },
			],
		}).compile();

		service = module.get<UserPanelService>(UserPanelService);
	});

	describe('executeCommand', () => {
		it('debe enviar payload JSON con version y domain', async () => {
			const mockResponse = {
				status: 'success',
				content: { language: 'es' },
			};
			mockAxios.post.mockResolvedValue({ data: mockResponse });

			const result = await service.executeCommand('someCmd', { foo: 'bar' });

			expect(result).toEqual(mockResponse);
			expect(mockAxios.post).toHaveBeenCalledWith(
				'https://api.luckybet.site/?act=command&area=cmd',
				{
					cmd: 'someCmd',
					version: 9,
					domain: 'luckybet.site',
					foo: 'bar',
				},
				expect.objectContaining({
					headers: expect.objectContaining({
						'Content-Type': 'application/json',
					}),
				}),
			);
		});

		it('debe capturar errores de axios y retornar el envelope de error de LuckyBet', async () => {
			mockAxios.post.mockRejectedValue({
				isAxiosError: true,
				response: {
					data: {
						status: 'fail',
						errorCode: 'authorize_error',
						error: 'Autorización fallida',
					},
				},
			});

			const result = await service.executeCommand('terminalInfo');
			expect(result.status).toBe('fail');
			expect(result.errorCode).toBe('authorize_error');
		});
	});

	describe('terminalInfo', () => {
		it('debe llamar a terminalInfo con el token provisto', async () => {
			const profile = {
				id: 8_744_343,
				login: 'serrot99',
				cash: '5000',
				currency: 'ARS',
			};
			mockAxios.post.mockResolvedValue({
				data: {
					status: 'success',
					content: profile,
				},
			});

			const result = await service.terminalInfo('mock_token_32hex');
			expect(result.status).toBe('success');
			expect(result.content).toEqual(profile);
			expect(mockAxios.post).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					cmd: 'terminalInfo',
					token: 'mock_token_32hex',
					first: false,
				}),
				expect.anything(),
			);
		});
	});

	describe('login', () => {
		it('debe invocar el comando authorization con type=login', async () => {
			mockAxios.post.mockResolvedValue({
				data: {
					status: 'success',
					token: 'generated_token_32hex',
					content: { language: 'es' },
				},
			});

			const result = await service.login('serrot99', 'pass123');
			expect(result.status).toBe('success');
			expect(result.token).toBe('generated_token_32hex');
			expect(mockAxios.post).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					cmd: 'authorization',
					type: 'login',
					data: { login: 'serrot99', password: 'pass123' },
				}),
				expect.anything(),
			);
		});
	});

	describe('getGameList', () => {
		it('debe retornar catálogo desde caché si existe', async () => {
			const cachedCatalog = [
				{ id: '101', name: 'sweet_bonanza', title: 'Sweet Bonanza' },
			];
			mockCache.get.mockResolvedValue(cachedCatalog);

			const games = await service.getGameList();
			expect(games).toEqual(cachedCatalog);
			expect(mockAxios.post).not.toHaveBeenCalled();
		});

		it('debe consultar la API y guardar en Redis si no está en caché', async () => {
			mockCache.get.mockResolvedValue(null);
			const apiGames = [
				{
					id: '102',
					name: 'gates_of_olympus',
					title: 'Gates of Olympus',
					provider: 'Pragmatic',
				},
			];
			mockAxios.post.mockResolvedValue({
				data: {
					status: 'success',
					content: apiGames,
				},
			});

			const games = await service.getGameList('token_123');
			expect(games).toEqual(apiGames);
			expect(mockCache.set).toHaveBeenCalledWith(
				LUCKYBET_GAME_CATALOG_CACHE_KEY,
				apiGames,
				3600,
			);
		});
	});

	describe('getLastPlayedGame', () => {
		it('debe retornar null si el token es inválido o terminalInfo falla', async () => {
			mockAxios.post.mockResolvedValue({
				data: {
					status: 'fail',
					errorCode: 'authorize_error',
				},
			});

			const result = await service.getLastPlayedGame('invalid_token');
			expect(result).toBeNull();
		});

		it('debe retornar desde caché si ya fue consultado recientemente', async () => {
			mockAxios.post.mockResolvedValue({
				data: {
					status: 'success',
					content: { id: 8_744_343, login: 'serrot99' },
				},
			});
			const cachedGame = {
				gameId: '102',
				gameName: 'Gates of Olympus',
				isCurrentlyPlaying: true,
			};
			mockCache.get.mockResolvedValue(cachedGame);

			const result = await service.getLastPlayedGame('valid_token');
			expect(result).toEqual(cachedGame);
		});

		it('debe extraer el juego activo y enriquecer con catálogo si no está en caché', async () => {
			mockCache.get.mockResolvedValue(null);

			// 1. terminalInfo
			mockAxios.post.mockResolvedValueOnce({
				data: {
					status: 'success',
					content: {
						id: 8_744_343,
						login: 'serrot99',
						game: 'gates_of_olympus',
						last: '2026-09-14 15:30:00',
					},
				},
			});

			// 2. gameList
			mockAxios.post.mockResolvedValueOnce({
				data: {
					status: 'success',
					content: [
						{
							id: '102',
							name: 'gates_of_olympus',
							title: 'Gates of Olympus',
							provider: 'Pragmatic',
							img: 'https://cdn.cdnpin.com/resources/gates.png',
						},
					],
				},
			});

			const result = await service.getLastPlayedGame('valid_token');

			expect(result).not.toBeNull();
			expect(result?.gameId).toBe('gates_of_olympus');
			expect(result?.gameName).toBe('Gates of Olympus');
			expect(result?.provider).toBe('Pragmatic');
			expect(result?.imageUrl).toBe('https://cdn.cdnpin.com/resources/gates.png');
			expect(result?.isCurrentlyPlaying).toBe(true);
			expect(mockCache.set).toHaveBeenCalledWith(
				'luckybet:player:last_game:8744343',
				expect.objectContaining({ gameName: 'Gates of Olympus' }),
				300,
			);
		});
	});
});
