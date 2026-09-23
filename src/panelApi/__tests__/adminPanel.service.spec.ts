import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { BonusIntern } from '@/src/types/bonus';
import { CACHE_PORT } from '../../shared/cache/constants';
import { AdminPanelService } from '../adapters/driven/adminPanel.service';
import {
	AXIOS_ADMIN_PANEL,
	LUCKYBET_ADMIN_SESSION_CACHE_KEY,
	LUCKYBET_GAME_CATALOG_CACHE_KEY,
} from '../constants';

describe('AdminPanelService', () => {
	let service: AdminPanelService;
	let mockCache: {
		get: jest.Mock;
		set: jest.Mock;
		del: jest.Mock;
		exists: jest.Mock;
		ttl: jest.Mock;
	};
	let mockAxios: {
		post: jest.Mock;
		get: jest.Mock;
	};
	let mockConfig: {
		get: jest.Mock;
	};

	beforeEach(async () => {
		mockCache = {
			get: jest.fn(),
			set: jest.fn(),
			del: jest.fn(),
			exists: jest.fn(),
			ttl: jest.fn(),
		};

		mockAxios = {
			post: jest.fn(),
			get: jest.fn(),
		};

		mockConfig = {
			get: jest.fn((key: string, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					LUCKYBET_PANEL_HOST: 'https://ag.luckybet.site',
					LUCKYBET_ADMIN_LOGIN: 'test_admin',
					LUCKYBET_ADMIN_PASSWORD: 'secret_password',
					LUCKYBET_SESSION_TTL_SECONDS: 240,
					LUCKYBET_GAME_ACTIVITY_TTL_SECONDS: 300,
				};
				return values[key] ?? defaultValue;
			}),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AdminPanelService,
				{ provide: ConfigService, useValue: mockConfig },
				{ provide: CACHE_PORT, useValue: mockCache },
				{ provide: AXIOS_ADMIN_PANEL, useValue: mockAxios },
			],
		}).compile();

		service = module.get<AdminPanelService>(AdminPanelService);
	});

	describe('ensureSession', () => {
		it('debe retornar la sesión existente desde Redis si está disponible', async () => {
			mockCache.get.mockResolvedValue('cached_phpsessid_123');

			const session = await service.ensureSession();
			expect(session).toBe('cached_phpsessid_123');
			expect(mockAxios.post).not.toHaveBeenCalled();
		});

		it('debe realizar login y guardar la cookie en Redis si no está en caché', async () => {
			mockCache.get.mockResolvedValue(null);
			mockAxios.post.mockResolvedValue({
				status: 302,
				headers: {
					'set-cookie': [
						'PHPSESSID=ignored_first; path=/',
						'PHPSESSID=valid_second_cookie; path=/',
					],
				},
				data: '',
			});

			const session = await service.ensureSession();
			expect(session).toBe('valid_second_cookie');
			expect(mockCache.set).toHaveBeenCalledWith(
				LUCKYBET_ADMIN_SESSION_CACHE_KEY,
				'valid_second_cookie',
				240,
			);
		});
	});

	describe('searchPlayer', () => {
		it('debe buscar jugadores por POST form-urlencoded con Cookie de sesión', async () => {
			mockCache.get.mockResolvedValue('session_xyz');
			mockAxios.post.mockResolvedValue({
				data: {
					search: 'serrot99',
					users: [{ id: '8744343', login: 'serrot99', group: '5' }],
				},
			});

			const users = await service.searchPlayer('serrot99', 1);

			expect(users).toHaveLength(1);
			expect(users[0].login).toBe('serrot99');
			expect(mockAxios.post).toHaveBeenCalledWith(
				'https://ag.luckybet.site/index.php?act=admin&area=search&response=js',
				'search_login=serrot99&page=1',
				expect.objectContaining({
					headers: expect.objectContaining({
						Cookie: 'PHPSESSID=session_xyz',
					}),
				}),
			);
		});
	});

	describe('getPlayerBalance', () => {
		it('debe consultar balance por GET con parámetros de consulta', async () => {
			mockCache.get.mockResolvedValue('session_xyz');
			mockAxios.get.mockResolvedValue({
				data: {
					currencies: { ARS: '5000.00' },
					operationsData: [],
				},
			});

			const balance = await service.getPlayerBalance('8744343', {
				limit: 10,
				from: '2026-09-01 00:00:00',
				to: '2026-09-14 23:59:59',
			});

			expect(balance.currencies.ARS).toBe('5000.00');
			expect(mockAxios.get).toHaveBeenCalledWith(
				expect.stringContaining('id=8744343'),
				expect.objectContaining({
					headers: expect.objectContaining({
						Cookie: 'PHPSESSID=session_xyz',
					}),
				}),
			);
		});
	});

	describe('creditPlayer y debitPlayer', () => {
		it('debe enviar el monto 1:1 al acreditar fichas y extraer operationId', async () => {
			mockCache.get.mockResolvedValue('session_xyz');
			mockAxios.post.mockResolvedValue({
				data: {
					successMessage: 'Balance es cambiado con éxito',
					printUrl: 'index.php?act=admin&area=printreport&operation=987654',
					currencies: { ARS: '4000.00' },
				},
			});

			const result = await service.creditPlayer('8744343', 2000, {
				currency: 'ARS',
			});

			expect(result.success).toBe(true);
			expect(result.operationId).toBe('987654');
			expect(result.amountRequested).toBe(2000);
			expect(result.amountSent).toBe(2000);
			expect(mockAxios.post).toHaveBeenCalledWith(
				expect.stringContaining('id=8744343'),
				expect.stringContaining('amount=2000'),
				expect.anything(),
			);
		});

		it('debe enviar parámetros de bonus y promocode cuando se suministran', async () => {
			mockCache.get.mockResolvedValue('session_xyz');
			mockAxios.post.mockResolvedValue({
				data: {
					successMessage: 'Balance es cambiado con éxito',
					printUrl: 'index.php?act=admin&area=printreport&operation=987654',
				},
			});

			const result = await service.creditPlayer('8744343', 5000, {
				currency: 'ARS',
				bonus: BonusIntern.OneHundred,
				promocode: 'BIENVENIDA_100',
			});

			expect(result.success).toBe(true);
			expect(result.bonusApplied).toBe(BonusIntern.OneHundred);
			expect(result.promocodeApplied).toBe('BIENVENIDA_100');
			expect(mockAxios.post).toHaveBeenCalledWith(
				expect.stringContaining('id=8744343'),
				expect.stringContaining('bonus=100'),
				expect.anything(),
			);
		});

		it('debe enviar el monto 1:1 al debitar fichas', async () => {
			mockCache.get.mockResolvedValue('session_xyz');
			mockAxios.post.mockResolvedValue({
				data: {
					successMessage: 'Balance es cambiado con éxito',
					printUrl: 'index.php?act=admin&area=printreport&operation=123456',
				},
			});

			const result = await service.debitPlayer('8744343', 1000);

			expect(result.success).toBe(true);
			expect(result.operationId).toBe('123456');
			expect(result.amountSent).toBe(1000);
		});
	});

	describe('getPlayerHistory', () => {
		it('debe enviar parámetros from, to, limit y session a area=history', async () => {
			mockCache.get.mockResolvedValue('session_xyz');
			mockAxios.get.mockResolvedValue({
				data: {
					sessions: [{ id: 1, game: 'sweet_bonanza', wager: 100 }],
				},
			});

			const result = await service.getPlayerHistory('8744343', {
				session: 'sess_123',
				from: '2026-09-01 00:00:00',
				to: '2026-09-07 00:00:00',
				limit: 500,
			});

			expect(result.sessions).toHaveLength(1);
			expect(mockAxios.get).toHaveBeenCalledWith(
				expect.stringContaining('area=history'),
				expect.objectContaining({
					headers: expect.objectContaining({
						Cookie: 'PHPSESSID=session_xyz',
					}),
				}),
			);
			expect(mockAxios.get).toHaveBeenCalledWith(
				expect.stringContaining('limit=500'),
				expect.anything(),
			);
			expect(mockAxios.get).toHaveBeenCalledWith(
				expect.stringContaining('session=sess_123'),
				expect.anything(),
			);
		});
	});

	describe('getLastPlayedGames', () => {
		it('debe retornar historial desde caché si existe en Redis', async () => {
			const cachedResult = {
				userId: '8744343',
				periodDays: 7,
				from: '2026-09-07 00:00:00',
				to: '2026-09-14 00:00:00',
				games: [
					{
						gameId: 'sweet_bonanza',
						gameName: 'Sweet Bonanza',
						lastPlayedAt: '2026-09-14 12:00:00',
						playCount: 5,
					},
				],
				totalUniqueGames: 1,
			};
			mockCache.get.mockImplementation((key: string) => {
				if (key.startsWith('luckybet:player:recent_games:')) {
					return Promise.resolve(cachedResult);
				}
				return Promise.resolve('session_xyz');
			});

			const result = await service.getLastPlayedGames('8744343');

			expect(result).toEqual(cachedResult);
			expect(mockAxios.get).not.toHaveBeenCalled();
		});

		it('debe consultar historial con area=history, deduplicar juegos y enriquecer con catálogo CDN', async () => {
			mockCache.get.mockImplementation((key: string) => {
				if (key === LUCKYBET_ADMIN_SESSION_CACHE_KEY) {
					return Promise.resolve('session_xyz');
				}
				if (key === LUCKYBET_GAME_CATALOG_CACHE_KEY) {
					return Promise.resolve([
						{
							id: 'sweet_bonanza',
							title: 'Sweet Bonanza 1000',
							provider: 'Pragmatic Play',
							img: 'https://cdn.cdnpin.com/resources/sweet.png',
						},
						{
							id: 'gates_of_olympus',
							title: 'Gates of Olympus',
							provider: 'Pragmatic Play',
							img: 'https://cdn.cdnpin.com/resources/gates.png',
						},
					]);
				}
				return Promise.resolve(null);
			});

			mockAxios.get.mockResolvedValueOnce({
				data: {
					sessions: [
						{
							id: '1',
							datetime: '2026-09-14 18:00:00',
							game: 'sweet_bonanza',
							game_name: 'Sweet Bonanza',
							wager: '200',
						},
						{
							id: '2',
							datetime: '2026-09-14 15:00:00',
							game: 'gates_of_olympus',
							game_name: 'Gates of Olympus',
							wager: '500',
						},
						{
							id: '3',
							datetime: '2026-09-13 10:00:00',
							game: 'sweet_bonanza',
							game_name: 'Sweet Bonanza',
							wager: '300',
						},
					],
				},
			});

			const result = await service.getLastPlayedGames('8744343', {
				days: 7,
				limit: 10,
			});

			expect(result.userId).toBe('8744343');
			expect(result.totalUniqueGames).toBe(2);
			expect(result.games).toHaveLength(2);

			const sweetBonanza = result.games[0];
			expect(sweetBonanza.gameId).toBe('sweet_bonanza');
			expect(sweetBonanza.gameName).toBe('Sweet Bonanza 1000');
			expect(sweetBonanza.imageUrl).toBe('https://cdn.cdnpin.com/resources/sweet.png');
			expect(sweetBonanza.provider).toBe('Pragmatic Play');
			expect(sweetBonanza.lastPlayedAt).toBe('2026-09-14 18:00:00');
			expect(sweetBonanza.playCount).toBe(2);
			expect(sweetBonanza.totalWagerInPeriod).toBe(500);

			const gates = result.games[1];
			expect(gates.gameId).toBe('gates_of_olympus');
			expect(gates.imageUrl).toBe('https://cdn.cdnpin.com/resources/gates.png');
			expect(gates.playCount).toBe(1);
			expect(gates.totalWagerInPeriod).toBe(500);

			expect(mockCache.set).toHaveBeenCalledWith(
				'luckybet:player:recent_games:8744343:7:10',
				expect.objectContaining({ totalUniqueGames: 2 }),
				300,
			);
		});

		it('debe hacer fallback a area=balance si area=history retorna vacío', async () => {
			mockCache.get.mockImplementation((key: string) => {
				if (key === LUCKYBET_ADMIN_SESSION_CACHE_KEY) {
					return Promise.resolve('session_xyz');
				}
				return Promise.resolve(null);
			});

			// First call to getPlayerHistory (area=history) returns empty sessions
			mockAxios.get.mockResolvedValueOnce({
				data: {
					sessions: [],
				},
			});

			// Second call to getPlayerBalance (area=balance) returns operationsData
			mockAxios.get.mockResolvedValueOnce({
				data: {
					currencies: { ARS: '5000' },
					operationsData: [
						{
							id: '1',
							datetime: '2026-09-14 18:00:00',
							game: 'sweet_bonanza',
							wager: '200',
						},
					],
				},
			});

			const result = await service.getLastPlayedGames('8744343', {
				days: 7,
				limit: 10,
			});

			expect(result.totalUniqueGames).toBe(1);
			expect(result.games[0].gameId).toBe('sweet_bonanza');
		});

		it('debe respetar el límite de juegos a retornar', async () => {
			mockCache.get.mockImplementation((key: string) => {
				if (key === LUCKYBET_ADMIN_SESSION_CACHE_KEY) {
					return Promise.resolve('session_xyz');
				}
				return Promise.resolve(null);
			});

			mockAxios.get.mockResolvedValueOnce({
				data: {
					sessions: [
						{ id: '1', datetime: '2026-09-14 18:00:00', game: 'game_1' },
						{ id: '2', datetime: '2026-09-14 17:00:00', game: 'game_2' },
						{ id: '3', datetime: '2026-09-14 16:00:00', game: 'game_3' },
					],
				},
			});

			const result = await service.getLastPlayedGames('8744343', {
				limit: 2,
			});

			expect(result.totalUniqueGames).toBe(3);
			expect(result.games).toHaveLength(2);
			expect(result.games[0].gameId).toBe('game_1');
			expect(result.games[1].gameId).toBe('game_2');
		});
	});

	describe('Re-autenticación automática ante sesión expirada', () => {
		it('debe renovar la sesión y reintentar si el panel responde redirect: login', async () => {
			mockCache.get.mockResolvedValueOnce('expired_cookie').mockResolvedValueOnce(null);

			mockAxios.post
				.mockResolvedValueOnce({
					data: { noMain: true, redirect: 'login' },
				})
				.mockResolvedValueOnce({
					status: 302,
					headers: {
						'set-cookie': ['PHPSESSID=new_valid_cookie; path=/'],
					},
					data: '',
				})
				.mockResolvedValueOnce({
					data: {
						users: [{ id: '8744343', login: 'serrot99' }],
					},
				});

			const users = await service.searchPlayer('serrot99');

			expect(mockCache.del).toHaveBeenCalledWith(LUCKYBET_ADMIN_SESSION_CACHE_KEY);
			expect(users).toHaveLength(1);
		});
	});
});
