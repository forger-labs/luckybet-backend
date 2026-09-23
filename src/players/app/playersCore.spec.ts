import {
	BadRequestException,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';

import type { ForPanelApiCore } from '@/src/panelApi/ports/forPanelApiCore.port';
import type { PlayerGameHistoryResult } from '@/src/panelApi/types/adminPanel.types';
import type { PlayerAuthContext } from '@/src/panelApi/types/panelApiCore.types';
import type { PlayerLastPlayedGameResult } from '@/src/panelApi/types/userPanel.types';
import type { ForDatabasePlayers } from '../ports/driver/ForDatabasePlayers';
import type { PlayerResponse } from './dto/player.schema';
import { PlayersCore } from './playersCore';

describe('PlayersCore', () => {
	let core: PlayersCore;
	let playersRepoMock: jest.Mocked<ForDatabasePlayers>;
	let panelApiCoreMock: jest.Mocked<ForPanelApiCore>;

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

	beforeEach(() => {
		playersRepoMock = {
			createPlayer: jest.fn(),
			findByUnique: jest.fn(),
			getPlayers: jest.fn(),
			updatePlayerById: jest.fn(),
		};

		panelApiCoreMock = {
			authenticatePlayer: jest.fn(),
			syncOrRegisterPlayer: jest.fn(),
			creditPlayer: jest.fn(),
			debitPlayer: jest.fn(),
			getLastPlayedGame: jest.fn(),
			getLastPlayedGames: jest.fn(),
			invalidatePlayerSession: jest.fn(),
			hashToken: jest.fn(),
		};

		core = new PlayersCore(playersRepoMock, panelApiCoreMock);
	});

	describe('createPlayer', () => {
		it('should create player if username does not exist', async () => {
			playersRepoMock.findByUnique.mockResolvedValueOnce(null);
			playersRepoMock.createPlayer.mockResolvedValueOnce(mockPlayer);

			const result = await core.createPlayer({
				username: 'testplayer',
				phone: '12345678',
				isActive: true,
			});

			expect(result).toEqual(mockPlayer);
			expect(playersRepoMock.createPlayer).toHaveBeenCalled();
		});

		it('should throw BadRequestException if username already exists', async () => {
			playersRepoMock.findByUnique.mockResolvedValueOnce(mockPlayer);

			await expect(
				core.createPlayer({
					username: 'testplayer',
					isActive: true,
				}),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('findById', () => {
		it('should return player if found', async () => {
			playersRepoMock.findByUnique.mockResolvedValueOnce(mockPlayer);

			const result = await core.findById(1);

			expect(result).toEqual(mockPlayer);
			expect(playersRepoMock.findByUnique).toHaveBeenCalledWith({ id: 1 });
		});

		it('should throw NotFoundException if player not found', async () => {
			playersRepoMock.findByUnique.mockResolvedValueOnce(null);

			await expect(core.findById(999)).rejects.toThrow(NotFoundException);
		});
	});

	describe('getPlayers', () => {
		it('should return list of players with pagination', async () => {
			playersRepoMock.getPlayers.mockResolvedValueOnce([[mockPlayer], 1]);

			const result = await core.getPlayers({ take: 10, skip: 0 });

			expect(result.players).toHaveLength(1);
			expect(result.total).toBe(1);
			expect(result.limit).toBe(10);
			expect(result.skip).toBe(0);
		});
	});

	describe('updatePlayerById', () => {
		it('should update player and return updated data', async () => {
			const updated = { ...mockPlayer, phone: '87654321' };
			playersRepoMock.updatePlayerById.mockResolvedValueOnce(updated);

			const result = await core.updatePlayerById(1, { phone: '87654321' });

			expect(result.phone).toBe('87654321');
		});

		it('should throw NotFoundException if player to update does not exist', async () => {
			playersRepoMock.updatePlayerById.mockResolvedValueOnce(null);

			await expect(core.updatePlayerById(999, { phone: '1111' })).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe('getLastPlayedGame', () => {
		it('should return last played game from panelApiCore', async () => {
			const mockLastGame: PlayerLastPlayedGameResult = {
				gameId: 'sweet_bonanza',
				gameName: 'Sweet Bonanza 1000',
				provider: 'Pragmatic Play',
				imageUrl: 'https://cdn.cdnpin.com/resources/sweet.png',
				lastPlayedAt: '2026-09-21 15:00:00',
				isCurrentlyPlaying: true,
			};

			panelApiCoreMock.getLastPlayedGame.mockResolvedValueOnce(mockLastGame);

			const result = await core.getLastPlayedGame('valid-token-123');

			expect(result).toEqual(mockLastGame);
			expect(panelApiCoreMock.getLastPlayedGame).toHaveBeenCalledWith('valid-token-123');
		});

		it('should throw UnauthorizedException if token is empty', async () => {
			await expect(core.getLastPlayedGame('')).rejects.toThrow(UnauthorizedException);
		});

		it('should throw BadRequestException if panelApiCore is not injected', async () => {
			const coreWithoutPanel = new PlayersCore(playersRepoMock, undefined);

			await expect(coreWithoutPanel.getLastPlayedGame('token-123')).rejects.toThrow(
				BadRequestException,
			);
		});
	});

	describe('getPlayedGames', () => {
		it('should return deduplicated game history using luckyBetId', async () => {
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
						playCount: 3,
						totalWagerInPeriod: 600,
					},
				],
			};

			panelApiCoreMock.getLastPlayedGames.mockResolvedValueOnce(mockHistory);

			const result = await core.getPlayedGames(mockAuthContext, {
				days: 7,
				limit: 10,
				provider: 'Pragmatic Play',
			});

			expect(result).toEqual(mockHistory);
			expect(panelApiCoreMock.getLastPlayedGames).toHaveBeenCalledWith(
				'8744343',
				expect.objectContaining({
					days: 7,
					limit: 10,
					provider: 'Pragmatic Play',
				}),
			);
		});

		it('should fallback to username if luckyBetId is not present', async () => {
			const authWithoutLuckyBetId: PlayerAuthContext = {
				id: 2,
				username: 'player_no_id',
				isActive: true,
			};

			panelApiCoreMock.getLastPlayedGames.mockResolvedValueOnce({
				userId: 'player_no_id',
				periodDays: 7,
				from: '2026-09-14 00:00:00',
				to: '2026-09-21 23:59:59',
				totalUniqueGames: 0,
				games: [],
			});

			const result = await core.getPlayedGames(authWithoutLuckyBetId);

			expect(panelApiCoreMock.getLastPlayedGames).toHaveBeenCalledWith(
				'player_no_id',
				undefined,
			);
			expect(result.userId).toBe('player_no_id');
		});
	});
});
