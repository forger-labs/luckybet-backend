import {
	BadRequestException,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { PlayerWithoutAudit } from '@/src/players/app/dto/player.schema';
import type { ForDatabasePlayers } from '@/src/players/ports/driver/ForDatabasePlayers';
import type { ForCache } from '../../shared/cache/ports/forCache.port';
import { PanelApiCore } from '../app/panelApiCore';
import type { ForAdminPanel } from '../ports/forAdminPanel.port';
import type { ForUserPanel } from '../ports/forUserPanel.port';

describe('PanelApiCore', () => {
	let panelApiCore: PanelApiCore;
	let configServiceMock: jest.Mocked<ConfigService>;
	let userPanelMock: jest.Mocked<ForUserPanel>;
	let adminPanelMock: jest.Mocked<ForAdminPanel>;
	let cacheMock: jest.Mocked<ForCache>;
	let playerRepoMock: jest.Mocked<ForDatabasePlayers>;

	beforeEach(() => {
		configServiceMock = {
			get: jest.fn().mockImplementation((key: string, defaultValue?: unknown) => {
				if (key === 'LUCKYBET_PLAYER_TOKEN_SESSION_TTL_SECONDS') return 120;
				return defaultValue;
			}),
		} as unknown as jest.Mocked<ConfigService>;

		userPanelMock = {
			executeCommand: jest.fn(),
			terminalInfo: jest.fn(),
			login: jest.fn(),
			getGameList: jest.fn(),
			getLastPlayedGame: jest.fn(),
		};

		adminPanelMock = {
			searchPlayer: jest.fn(),
			getPlayerBalance: jest.fn(),
			getPlayerHistory: jest.fn(),
			creditPlayer: jest.fn(),
			debitPlayer: jest.fn(),
			getLastPlayedGames: jest.fn(),
			ensureSession: jest.fn(),
      invalidateSession: jest.fn(),
      changePlayerSenior: jest.fn(),
			getPlayerSenior:jest.fn()
		};

		cacheMock = {
			get: jest.fn().mockResolvedValue(null),
			set: jest.fn().mockResolvedValue(undefined),
			del: jest.fn().mockResolvedValue(undefined),
			exists: jest.fn().mockResolvedValue(false),
			ttl: jest.fn().mockResolvedValue(120),
		};

		playerRepoMock = {
			createPlayer: jest.fn(),
			findByUnique: jest.fn(),
			getPlayers: jest.fn(),
      updatePlayerById: jest.fn(),
			addExperienceAndRecalculateLevel: jest.fn()
		};

		panelApiCore = new PanelApiCore(
			configServiceMock,
			userPanelMock,
			adminPanelMock,
			cacheMock,
			playerRepoMock,
		);
	});

	describe('hashToken', () => {
		it('should generate a 64-character hex SHA-256 hash', () => {
			const hash = panelApiCore.hashToken('test-token-123');
			expect(hash).toHaveLength(64);
			expect(hash).toMatch(/^[a-f0-9]{64}$/);
		});

		it('should produce identical hashes for tokens with leading/trailing spaces', () => {
			const hash1 = panelApiCore.hashToken('test-token');
			const hash2 = panelApiCore.hashToken('  test-token  ');
			expect(hash1).toBe(hash2);
		});
	});

	describe('authenticatePlayer', () => {
		it('should throw UnauthorizedException if token is empty or invalid', async () => {
			await expect(panelApiCore.authenticatePlayer('')).rejects.toThrow(
				UnauthorizedException,
			);
			await expect(panelApiCore.authenticatePlayer('   ')).rejects.toThrow(
				UnauthorizedException,
			);
		});

		it('should return cached context on cache hit without calling terminalInfo', async () => {
			const cachedContext = {
				id: 10,
				username: 'cacheduser',
				phone: '12345678',
				isActive: true,
				levelId: 1,
				cash: 5000,
				currency: 'ARS',
			};
			cacheMock.get.mockResolvedValueOnce(cachedContext);

			const result = await panelApiCore.authenticatePlayer('cached-token');

			expect(result).toEqual(cachedContext);
			expect(cacheMock.get).toHaveBeenCalledWith(
				expect.stringContaining('luckybet:session:token:'),
			);
			expect(userPanelMock.terminalInfo).not.toHaveBeenCalled();
		});

		it('should throw UnauthorizedException when terminalInfo returns fail', async () => {
			cacheMock.get.mockResolvedValueOnce(null);
			userPanelMock.terminalInfo.mockResolvedValueOnce({
				status: 'fail',
				errorCode: 'authorize_error',
				error: 'Token expirado o revocado',
			});

			await expect(panelApiCore.authenticatePlayer('invalid-token')).rejects.toThrow(
				UnauthorizedException,
			);
		});

		it('should auto-register a new player if they do not exist locally', async () => {
			cacheMock.get.mockResolvedValueOnce(null);
			userPanelMock.terminalInfo.mockResolvedValueOnce({
				status: 'success',
				content: {
					id: 999,
					login: 'newplayer123',
					cash: '1500',
					currency: 'ARS',
					phone: '11223344',
				},
			});

			playerRepoMock.findByUnique.mockResolvedValueOnce(null);
			playerRepoMock.createPlayer.mockResolvedValueOnce({
				id: 42,
				username: 'newplayer123',
				phone: '11223344',
				isActive: true,
				experience: 0,
			});

			const result = await panelApiCore.authenticatePlayer('new-valid-token');

			expect(playerRepoMock.findByUnique).toHaveBeenCalledWith({
				username: 'newplayer123',
			});
			expect(playerRepoMock.createPlayer).toHaveBeenCalledWith({
				username: 'newplayer123',
				phone: '11223344',
				isActive: true,
			});
			expect(result).toMatchObject({
				id: 42,
				username: 'newplayer123',
				phone: '11223344',
				isActive: true,
				cash: 1500,
				currency: 'ARS',
				luckyBetId: '999',
				isNewlyRegistered: true,
			});
			expect(cacheMock.set).toHaveBeenCalledWith(
				expect.stringContaining('luckybet:session:token:'),
				expect.objectContaining({ id: 42, username: 'newplayer123' }),
				120,
			);
		});

		it('should auto-reactivate a restored player if they were marked inactive locally', async () => {
			cacheMock.get.mockResolvedValueOnce(null);
			userPanelMock.terminalInfo.mockResolvedValueOnce({
				status: 'success',
				content: {
					id: 888,
					login: 'restoreduser',
					cash: 2500,
					currency: 'ARS',
				},
			});

			const inactivePlayer: PlayerWithoutAudit = {
				id: 55,
				username: 'restoreduser',
				phone: null,
				isActive: false,
				experience: 0,
			};
			playerRepoMock.findByUnique.mockResolvedValueOnce(inactivePlayer);
			playerRepoMock.updatePlayerById.mockResolvedValueOnce({
				...inactivePlayer,
				isActive: true,
			});

			const result = await panelApiCore.authenticatePlayer('restored-token');

			expect(playerRepoMock.updatePlayerById).toHaveBeenCalledWith(55, {
				isActive: true,
			});
			expect(result.wasReactivated).toBe(true);
			expect(result.isActive).toBe(true);
		});

		it('should bypass cache when forceRefresh is true', async () => {
			userPanelMock.terminalInfo.mockResolvedValueOnce({
				status: 'success',
				content: {
					id: 777,
					login: 'activeuser',
					cash: 1000,
					currency: 'ARS',
				},
			});
			playerRepoMock.findByUnique.mockResolvedValueOnce({
				id: 77,
				username: 'activeuser',
				phone: null,
				isActive: true,
				experience: 0,
			});

			const result = await panelApiCore.authenticatePlayer('token-refresh', {
				forceRefresh: true,
			});

			expect(cacheMock.get).not.toHaveBeenCalled();
			expect(userPanelMock.terminalInfo).toHaveBeenCalledWith('token-refresh');
			expect(result.id).toBe(77);
		});
	});

	describe('invalidatePlayerSession', () => {
		it('should delete token hash key from Redis', async () => {
			await panelApiCore.invalidatePlayerSession('token-to-delete');
			expect(cacheMock.del).toHaveBeenCalledWith(
				expect.stringContaining('luckybet:session:token:'),
			);
		});

		it('should do nothing if token is empty', async () => {
			await panelApiCore.invalidatePlayerSession('');
			expect(cacheMock.del).not.toHaveBeenCalled();
		});
	});

	describe('creditPlayer', () => {
		it('should throw BadRequestException if amount is less than or equal to 0', async () => {
			await expect(panelApiCore.creditPlayer(8_744_343, 0)).rejects.toThrow(
				BadRequestException,
			);
			await expect(panelApiCore.creditPlayer(8_744_343, -100)).rejects.toThrow(
				BadRequestException,
			);
		});

		it('should credit balance with direct numeric userId', async () => {
			adminPanelMock.creditPlayer.mockResolvedValueOnce({
				success: true,
				operationId: '12345',
				amountSent: 2000,
				currencies: { ARS: '2000' },
			});

			const result = await panelApiCore.creditPlayer(8_744_343, 2000, {
				currency: 'ARS',
			});

			expect(result.success).toBe(true);
			expect(adminPanelMock.creditPlayer).toHaveBeenCalledWith('8744343', 2000, {
				currency: 'ARS',
			});
		});

		it('should resolve username to userId via searchPlayer before crediting', async () => {
			adminPanelMock.searchPlayer.mockResolvedValueOnce([
				{ id: '8744343', login: 'serrot99' },
			]);
			adminPanelMock.creditPlayer.mockResolvedValueOnce({
				success: true,
				operationId: '67890',
				amountSent: 5000,
			});

			const result = await panelApiCore.creditPlayer('serrot99', 5000);

			expect(adminPanelMock.searchPlayer).toHaveBeenCalledWith('serrot99');
			expect(adminPanelMock.creditPlayer).toHaveBeenCalledWith(
				'8744343',
				5000,
				undefined,
			);
			expect(result.success).toBe(true);
		});

		it('should throw NotFoundException if username cannot be resolved in LuckyBet', async () => {
			adminPanelMock.searchPlayer.mockResolvedValueOnce([]);

			await expect(panelApiCore.creditPlayer('unknown_user', 1000)).rejects.toThrow(
				NotFoundException,
			);
			expect(adminPanelMock.creditPlayer).not.toHaveBeenCalled();
		});
	});

	describe('debitPlayer', () => {
		it('should throw BadRequestException if amount <= 0 and all is not true', async () => {
			await expect(panelApiCore.debitPlayer(8_744_343, 0)).rejects.toThrow(
				BadRequestException,
			);
		});

		it('should allow amount 0 when all is true (total withdrawal)', async () => {
			adminPanelMock.debitPlayer.mockResolvedValueOnce({
				success: true,
				operationId: '99999',
				amountSent: 0,
			});

			const result = await panelApiCore.debitPlayer(8_744_343, 0, {
				all: true,
			});

			expect(result.success).toBe(true);
			expect(adminPanelMock.debitPlayer).toHaveBeenCalledWith('8744343', 0, {
				all: true,
			});
		});

		it('should debit balance with username resolution', async () => {
			adminPanelMock.searchPlayer.mockResolvedValueOnce([
				{ id: '8744343', login: 'serrot99' },
			]);
			adminPanelMock.debitPlayer.mockResolvedValueOnce({
				success: true,
				operationId: '88888',
				amountSent: 1500,
			});

			const result = await panelApiCore.debitPlayer('serrot99', 1500);

			expect(adminPanelMock.searchPlayer).toHaveBeenCalledWith('serrot99');
			expect(adminPanelMock.debitPlayer).toHaveBeenCalledWith('8744343', 1500, undefined);
			expect(result.success).toBe(true);
		});
	});

	describe('getLastPlayedGames', () => {
		it('should retrieve played games and enrich them with gameList catalog images and metadata', async () => {
			userPanelMock.getGameList.mockResolvedValueOnce([
				{
					id: 'sweet_bonanza',
					name: 'sweet_bonanza',
					title: 'Sweet Bonanza 1000',
					provider: 'Pragmatic Play',
					img: 'https://cdn.cdnpin.com/resources/games/sweet_bonanza.png',
				},
				{
					id: 'gates_of_olympus',
					name: 'gates_of_olympus',
					title: 'Gates of Olympus',
					provider: 'Pragmatic Play',
					img: 'https://cdn.cdnpin.com/resources/games/gates.png',
				},
			]);

			adminPanelMock.getLastPlayedGames.mockResolvedValueOnce({
				userId: '8744343',
				periodDays: 7,
				from: '2026-09-14 00:00:00',
				to: '2026-09-21 00:00:00',
				totalUniqueGames: 2,
				games: [
					{
						gameId: 'sweet_bonanza',
						gameName: 'Sweet Bonanza',
						lastPlayedAt: '2026-09-21 12:00:00',
						playCount: 4,
						totalWagerInPeriod: 1200,
					},
					{
						gameId: 'gates_of_olympus',
						gameName: 'Gates of Olympus',
						lastPlayedAt: '2026-09-20 18:00:00',
						playCount: 1,
						totalWagerInPeriod: 500,
					},
				],
			});

			const result = await panelApiCore.getLastPlayedGames('8744343', {
				days: 7,
				limit: 10,
			});

			expect(result.userId).toBe('8744343');
			expect(result.games).toHaveLength(2);

			const sweet = result.games[0];
			expect(sweet.gameId).toBe('sweet_bonanza');
			expect(sweet.gameName).toBe('Sweet Bonanza 1000');
			expect(sweet.provider).toBe('Pragmatic Play');
			expect(sweet.imageUrl).toBe(
				'https://cdn.cdnpin.com/resources/games/sweet_bonanza.png',
			);

			const gates = result.games[1];
			expect(gates.gameId).toBe('gates_of_olympus');
			expect(gates.provider).toBe('Pragmatic Play');
			expect(gates.imageUrl).toBe('https://cdn.cdnpin.com/resources/games/gates.png');
		});

		it('should resolve username before querying last played games', async () => {
			adminPanelMock.searchPlayer.mockResolvedValueOnce([
				{ id: '8744343', login: 'serrot99' },
			]);
			userPanelMock.getGameList.mockResolvedValueOnce([]);
			adminPanelMock.getLastPlayedGames.mockResolvedValueOnce({
				userId: '8744343',
				periodDays: 7,
				from: '2026-09-14 00:00:00',
				to: '2026-09-21 00:00:00',
				totalUniqueGames: 0,
				games: [],
			});

			const result = await panelApiCore.getLastPlayedGames('serrot99');

			expect(adminPanelMock.searchPlayer).toHaveBeenCalledWith('serrot99');
			expect(adminPanelMock.getLastPlayedGames).toHaveBeenCalledWith(
				'8744343',
				undefined,
			);
			expect(result.userId).toBe('8744343');
		});

		it('should filter games in memory by provider and gameName', async () => {
			userPanelMock.getGameList.mockResolvedValueOnce([
				{
					id: 'game_1',
					name: 'game_1',
					title: 'Wolf Gold',
					provider: 'Pragmatic Play',
				},
				{
					id: 'game_2',
					name: 'game_2',
					title: 'Starbust',
					provider: 'NetEnt',
				},
			]);

			adminPanelMock.getLastPlayedGames.mockResolvedValueOnce({
				userId: '8744343',
				periodDays: 7,
				from: '2026-09-14 00:00:00',
				to: '2026-09-21 00:00:00',
				totalUniqueGames: 2,
				games: [
					{
						gameId: 'game_1',
						gameName: 'game_1',
						lastPlayedAt: '2026-09-21 12:00:00',
					},
					{
						gameId: 'game_2',
						gameName: 'game_2',
						lastPlayedAt: '2026-09-21 11:00:00',
					},
				],
			});

			const result = await panelApiCore.getLastPlayedGames('8744343', {
				provider: 'Pragmatic',
				gameName: 'Wolf',
			});

			expect(result.games).toHaveLength(1);
			expect(result.games[0].gameName).toBe('Wolf Gold');
			expect(result.totalUniqueGames).toBe(1);
		});
	});

	describe('getLastPlayedGame', () => {
		it('should delegate to userPanel.getLastPlayedGame', async () => {
			userPanelMock.getLastPlayedGame.mockResolvedValueOnce({
				gameId: 'sweet_bonanza',
				gameName: 'Sweet Bonanza',
				isCurrentlyPlaying: true,
			});

			const result = await panelApiCore.getLastPlayedGame('token-123');

			expect(result?.gameId).toBe('sweet_bonanza');
			expect(userPanelMock.getLastPlayedGame).toHaveBeenCalledWith('token-123');
		});

		it('should throw UnauthorizedException if token is empty', async () => {
			await expect(panelApiCore.getLastPlayedGame('')).rejects.toThrow(
				UnauthorizedException,
			);
		});
	});
});
