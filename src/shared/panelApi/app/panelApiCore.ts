import * as crypto from 'node:crypto';

import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PlayerRepoService } from '@/src/players/adapters/driven/PlayerRepo.service';
import type { PlayerWithoutAudit } from '@/src/players/app/dto/player.schema';
import type { ForDatabasePlayers } from '@/src/players/ports/driver/ForDatabasePlayers';
import { CACHE_PORT } from '../../cache/constants';
import type { ForCache } from '../../cache/ports/forCache.port';
import {
	DEFAULT_PLAYER_TOKEN_SESSION_TTL_SECONDS,
	FOR_ADMIN_PANEL,
	FOR_USER_PANEL,
	LUCKYBET_PLAYER_SESSION_KEY_PREFIX,
} from '../constants';
import type { ForAdminPanel } from '../ports/forAdminPanel.port';
import type { ForPanelApiCore } from '../ports/forPanelApiCore.port';
import type { ForUserPanel } from '../ports/forUserPanel.port';
import type {
	GetPlayedGamesOptions,
	LuckyBetBalanceMutationOptions,
	LuckyBetBalanceMutationResult,
	PlayerGameHistoryResult,
} from '../types/adminPanel.types';
import type {
	AuthenticatePlayerOptions,
	PlayerAuthContext,
} from '../types/panelApiCore.types';

@Injectable()
export class PanelApiCore implements ForPanelApiCore {
	private readonly logger = new Logger(PanelApiCore.name);
	private readonly sessionTtl: number;

	constructor(
		config: ConfigService,
		@Inject(FOR_USER_PANEL)
		private readonly userPanel: ForUserPanel,
		@Inject(FOR_ADMIN_PANEL)
		private readonly adminPanel: ForAdminPanel,
		@Inject(CACHE_PORT)
		private readonly cache: ForCache,
		@Inject(PlayerRepoService)
		private readonly playerRepo: ForDatabasePlayers,
	) {
		this.sessionTtl = Number(
			config.get<number | string>(
				'LUCKYBET_PLAYER_TOKEN_SESSION_TTL_SECONDS',
				DEFAULT_PLAYER_TOKEN_SESSION_TTL_SECONDS,
			),
		);
	}

	/**
	 * Computes a secure SHA-256 hash of the token for Redis key indexing.
	 * The plain-text token is never stored in Redis.
	 */
	hashToken(token: string): string {
		return crypto.createHash('sha256').update(token.trim()).digest('hex');
	}

	/**
	 * Authenticates a player token against LuckyBet terminalInfo,
	 * verifies cache in Redis, auto-registers if new, and auto-reactivates if restored.
	 */
	async authenticatePlayer(
		token: string,
		options?: AuthenticatePlayerOptions,
	): Promise<PlayerAuthContext> {
		if (!token || typeof token !== 'string' || !token.trim()) {
			throw new UnauthorizedException('Token de autenticación no proporcionado');
		}

		const tokenHash = this.hashToken(token);
		const cacheKey = `${LUCKYBET_PLAYER_SESSION_KEY_PREFIX}${tokenHash}`;

		if (!options?.forceRefresh) {
			const cached = await this.cache.get<PlayerAuthContext>(cacheKey);
			if (cached) {
				return cached;
			}
		}

		const terminalRes = await this.userPanel.terminalInfo(token);

		if (terminalRes.status !== 'success' || !terminalRes.content?.login) {
			this.logger.warn(
				`Fallo de autenticación en LuckyBet: ${terminalRes.error || terminalRes.errorCode || 'Token inválido'}`,
			);
			throw new UnauthorizedException(
				terminalRes.error ||
					'Sesión inválida o usuario no encontrado en el panel de LuckyBet',
			);
		}

		const content = terminalRes.content;
		const username = String(content.login).trim();
		const rawPhone = (content as Record<string, unknown>).phone;
		const phone = rawPhone ? String(rawPhone) : undefined;
		const cash = Number(content.cash) || 0;
		const currency = (content.currency as string) || 'ARS';
		const luckyBetId = content.id ? String(content.id) : undefined;

		const playerRecord = await this.syncOrRegisterPlayer(username, phone);

		const authContext: PlayerAuthContext = {
			id: playerRecord.id,
			username: playerRecord.username,
			phone: playerRecord.phone,
			isActive: playerRecord.isActive,
			levelId: (playerRecord as unknown as { levelId?: number }).levelId ?? null,
			cash,
			currency,
			luckyBetId,
			isNewlyRegistered: Boolean(playerRecord.isNew),
			wasReactivated: Boolean(playerRecord.wasReactivated),
		};

		await this.cache.set(cacheKey, authContext, this.sessionTtl);

		return authContext;
	}

	/**
	 * Finds or creates/reactivates a local player record based on LuckyBet username.
	 */
	async syncOrRegisterPlayer(
		username: string,
		phone?: string,
	): Promise<PlayerWithoutAudit & { isNew?: boolean; wasReactivated?: boolean }> {
		const existing = await this.playerRepo.findByUnique({ username });

		if (!existing) {
			this.logger.log(`Auto-registrando nuevo jugador: ${username}`);
			const created = await this.playerRepo.createPlayer({
				username,
				phone,
				isActive: true,
			});
			return {
				...created,
				isNew: true,
			};
		}

		if (!existing.isActive) {
			this.logger.log(`Auto-reactivando jugador restaurado en el panel: ${username}`);
			const updated = await this.playerRepo.updatePlayerById(existing.id, {
				isActive: true,
			});
			return {
				...(updated ?? existing),
				isActive: true,
				wasReactivated: true,
			};
		}

		return existing;
	}

	/**
	 * Invalidates a player's cached session in Redis.
	 */
	async invalidatePlayerSession(token: string): Promise<void> {
		if (!token) return;
		const tokenHash = this.hashToken(token);
		await this.cache.del(`${LUCKYBET_PLAYER_SESSION_KEY_PREFIX}${tokenHash}`);
	}

	/**
	 * Credits balance to a player in LuckyBet (deposit / carga de fichas),
	 * supporting resolution by numeric userId or username.
	 */
	async creditPlayer(
		userIdOrUsername: string | number,
		amount: number,
		options?: LuckyBetBalanceMutationOptions,
	): Promise<LuckyBetBalanceMutationResult> {
		if (amount <= 0) {
			throw new BadRequestException('El monto a acreditar debe ser mayor a cero');
		}

		const targetId = await this.resolveLuckyBetUserId(userIdOrUsername);
		return await this.adminPanel.creditPlayer(targetId, amount, options);
	}

	/**
	 * Debits balance from a player in LuckyBet (withdrawal / descarga de fichas),
	 * supporting resolution by numeric userId or username and total/partial withdrawals.
	 */
	async debitPlayer(
		userIdOrUsername: string | number,
		amount: number,
		options?: LuckyBetBalanceMutationOptions,
	): Promise<LuckyBetBalanceMutationResult> {
		if (!options?.all && amount <= 0) {
			throw new BadRequestException('El monto a debitar debe ser mayor a cero');
		}

		const targetId = await this.resolveLuckyBetUserId(userIdOrUsername);
		return await this.adminPanel.debitPlayer(targetId, amount, options);
	}

	/**
	 * Retrieves deduplicated played games for a user within a time period,
	 * cross-referencing with the game catalog (gameList) to enrich each game with CDN images.
	 */
	async getLastPlayedGames(
		userIdOrUsername: string | number,
		options?: GetPlayedGamesOptions & { token?: string },
	): Promise<PlayerGameHistoryResult> {
		const targetId = await this.resolveLuckyBetUserId(userIdOrUsername);

		// 1. Obtener catálogo completo de juegos (cacheado en Redis)
		const gameList = await this.userPanel.getGameList(options?.token);

		// 2. Obtener historial deduplicado desde adminPanel
		const history = await this.adminPanel.getLastPlayedGames(targetId, options);

		// 3. Cruzar cada juego con gameList para inyectar/confirmar imagen del CDN y metadata
		if (gameList && gameList.length > 0 && history.games?.length > 0) {
			for (const game of history.games) {
				const matched = gameList.find(
					item =>
						String(item.id).toLowerCase() === game.gameId.toLowerCase() ||
						(item.name && item.name.toLowerCase() === game.gameId.toLowerCase()),
				);
				if (matched) {
					if (matched.title || matched.name) {
						game.gameName = matched.title || matched.name || game.gameName;
					}
					if (matched.provider) {
						game.provider = matched.provider;
					}
					if (matched.img) {
						game.imageUrl = matched.img;
					}
				}
			}
		}

		return history;
	}

	/**
	 * Resolves a userId or username into a canonical numeric/string LuckyBet ID.
	 */
	private async resolveLuckyBetUserId(
		userIdOrUsername: string | number,
	): Promise<string | number> {
		const input = String(userIdOrUsername).trim();

		if (!input) {
			throw new BadRequestException('Identificador de usuario no proporcionado');
		}

		// Si ya es un ID numérico puro, retornarlo directamente
		if (/^\d+$/.test(input)) {
			return input;
		}

		// Si es un username alfanumérico, buscar en el panel de LuckyBet
		const searchResults = await this.adminPanel.searchPlayer(input);
		const matched = searchResults.find(
			u => u.login.toLowerCase() === input.toLowerCase(),
		);

		if (matched?.id) {
			return matched.id;
		}

		if (searchResults.length > 0 && searchResults[0].id) {
			return searchResults[0].id;
		}

		throw new NotFoundException(
			`No se encontró el jugador [${input}] en el panel de LuckyBet`,
		);
	}
}
