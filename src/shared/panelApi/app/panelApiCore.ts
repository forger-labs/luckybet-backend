import * as crypto from 'node:crypto';

import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PlayerRepoService } from '@/src/players/adapters/driven/PlayerRepo.service';
import type { PlayerWithoutAudit } from '@/src/players/app/dto/player.schema';
import type { ForDatabasePlayers } from '@/src/players/ports/driver/ForDatabasePlayers';
import { CACHE_PORT } from '../../cache/constants';
import type { ForCache } from '../../cache/ports/forCache.port';
import {
	DEFAULT_PLAYER_TOKEN_SESSION_TTL_SECONDS,
	FOR_USER_PANEL,
	LUCKYBET_PLAYER_SESSION_KEY_PREFIX,
} from '../constants';
import type { ForPanelApiCore } from '../ports/forPanelApiCore.port';
import type { ForUserPanel } from '../ports/forUserPanel.port';
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
}
