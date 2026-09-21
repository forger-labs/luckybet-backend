import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { PlayerWithoutAudit } from '@/src/players/app/dto/player.schema';
import type { ForDatabasePlayers } from '@/src/players/ports/driver/ForDatabasePlayers';
import type { ForCache } from '../../cache/ports/forCache.port';
import { PanelApiCore } from '../app/panelApiCore';
import type { ForUserPanel } from '../ports/forUserPanel.port';

describe('PanelApiCore', () => {
	let panelApiCore: PanelApiCore;
	let configServiceMock: jest.Mocked<ConfigService>;
	let userPanelMock: jest.Mocked<ForUserPanel>;
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
		};

		panelApiCore = new PanelApiCore(
			configServiceMock,
			userPanelMock,
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
});
