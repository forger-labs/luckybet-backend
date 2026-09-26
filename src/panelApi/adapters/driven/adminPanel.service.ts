import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AxiosInstance, AxiosResponse } from 'axios';
import axios from 'axios';

import { CACHE_PORT } from '../../../shared/cache/constants';
import type { ForCache } from '../../../shared/cache/ports/forCache.port';
import {
	AXIOS_ADMIN_PANEL,
	DEFAULT_LUCKYBET_GAME_ACTIVITY_TTL_SECONDS,
	DEFAULT_LUCKYBET_SESSION_TTL_SECONDS,
	DEFAULT_PLAYED_GAMES_DAYS,
	DEFAULT_PLAYED_GAMES_LIMIT,
	LUCKYBET_ADMIN_SESSION_CACHE_KEY,
	LUCKYBET_GAME_CATALOG_CACHE_KEY,
} from '../../constants';
import type { ForAdminPanel } from '../../ports/forAdminPanel.port';
import type {
	GetPlayedGamesOptions,
	LuckyBetBalanceMutationOptions,
	LuckyBetBalanceMutationResult,
	LuckyBetBalanceResponse,
	LuckyBetGetBalanceOptions,
	LuckyBetGetHistoryOptions,
	LuckyBetHistoryResponse,
	LuckyBetSearchResponse,
	LuckyBetSearchUser,
	PlayedGame,
	PlayerGameHistoryResult,
} from '../../types/adminPanel.types';

@Injectable()
export class AdminPanelService implements ForAdminPanel {
	/**
	 * Retrieves the current senior/room login of a player via area=useredit.
	 */
	async getPlayerSenior(userId: string | number): Promise<string | null> {
		const url = `${this.panelHost}/index.php?act=admin&area=useredit&id=${userId}&response=js`;

		try {
			const data = await this.requestWithSession<Record<string, unknown>>(sessionId => {
				return this.client.get<Record<string, unknown>>(url, {
					headers: {
						Accept: 'application/json',
						Cookie: `PHPSESSID=${String(sessionId)}`,
					},
				});
			});

			const fields = data.fields as Record<string, { value?: string }> | undefined;
			const senior = fields?.create_login?.value;
			return senior ? String(senior).trim() : null;
		} catch (error) {
			const errorMsg: string = error instanceof Error ? error.message : 'Unknown error';
			this.logger.error(
				'Error al obtener senior del jugador ' + String(userId) + ': ' + errorMsg,
			);
			return null;
		}
	}
	/**
	 * Changes the player senior/room in LuckyBet via area=useredit.
	 */
	async changePlayerSenior(
		userId: string | number,
		seniorName: string,
	): Promise<boolean> {
		const url = `${this.panelHost}/index.php?act=admin&area=useredit&id=${userId}&response=js`;
		const params = new URLSearchParams();
		params.append('send', 'true');
		params.append('create_login', seniorName);
		params.append('note', '');
		params.append('name', '');

		const data = await this.requestWithSession<Record<string, unknown>>(sessionId => {
			return this.client.post<Record<string, unknown>>(url, params.toString(), {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Accept: 'application/json',
					Cookie: `PHPSESSID=${String(sessionId)}`,
				},
			});
		});

		if (data.error || data.errorMessage) {
			this.logger.error(
				`Fallo al cambiar senior de usuario ${userId} a ${seniorName}: ${data.error || data.errorMessage}`,
			);
			return false;
		}

		return true;
	}
	private readonly logger = new Logger(AdminPanelService.name);
	private readonly panelHost: string;
	private readonly adminLogin: string;
	private readonly adminPassword: string;
	private readonly sessionTtl: number;
	private readonly gameActivityTtl: number;

	private loginPromise: Promise<string> | null = null;

	constructor(
		config: ConfigService,
		@Inject(CACHE_PORT)
		private readonly cache: ForCache,
		@Inject(AXIOS_ADMIN_PANEL)
		private readonly client: AxiosInstance,
	) {
		this.panelHost =
			config.get<string>('LUCKYBET_PANEL_HOST') ?? 'https://ag.luckybet.site';
		this.adminLogin = config.get<string>('LUCKYBET_ADMIN_LOGIN') ?? '';
		this.adminPassword = config.get<string>('LUCKYBET_ADMIN_PASSWORD') ?? '';
		this.sessionTtl = Number(
			config.get<number | string>(
				'LUCKYBET_SESSION_TTL_SECONDS',
				DEFAULT_LUCKYBET_SESSION_TTL_SECONDS,
			),
		);
		this.gameActivityTtl = Number(
			config.get<number | string>(
				'LUCKYBET_GAME_ACTIVITY_TTL_SECONDS',
				DEFAULT_LUCKYBET_GAME_ACTIVITY_TTL_SECONDS,
			),
		);
	}

	/**
	 * Returns a valid PHPSESSID session from Redis or performs authentication.
	 */
	async ensureSession(): Promise<string> {
		const cachedSession = await this.cache.get<string>(LUCKYBET_ADMIN_SESSION_CACHE_KEY);
		if (cachedSession) {
			return cachedSession;
		}

		if (this.loginPromise !== null) {
			return await this.loginPromise;
		}

		this.loginPromise = this.performLogin().finally(() => {
			this.loginPromise = null;
		});

		return await this.loginPromise;
	}

	/**
	 * Invalidates the active session in Redis.
	 */
	async invalidateSession(): Promise<void> {
		await this.cache.del(LUCKYBET_ADMIN_SESSION_CACHE_KEY);
	}

	private async performLogin(): Promise<string> {
		const loginUrl = `${this.panelHost}/index.php?act=admin&area=login`;
		const params = new URLSearchParams();
		params.append('login', this.adminLogin);
		params.append('password', this.adminPassword);

		try {
			const response = await this.client.post(loginUrl, params.toString(), {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				maxRedirects: 0,
				validateStatus: status => status === 200 || status === 302,
			});

			const rawSetCookie =
				response.headers['set-cookie'] || response.headers['Set-Cookie'];
			const sessionId = this.extractPhpSessionId(rawSetCookie);

			if (!sessionId) {
				throw new Error(
					'No se pudo extraer la cookie PHPSESSID de la respuesta de login del panel LuckyBet.',
				);
			}

			await this.cache.set(LUCKYBET_ADMIN_SESSION_CACHE_KEY, sessionId, this.sessionTtl);
			return sessionId;
		} catch (error) {
			this.logger.error('Error al autenticar en el panel de LuckyBet:', error);
			throw error;
		}
	}

	private extractPhpSessionId(
		setCookieHeader: string[] | string | undefined,
	): string | null {
		if (!setCookieHeader) {
			return null;
		}

		const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];

		let foundSessionId: string | null = null;

		for (const cookie of cookies) {
			const match = cookie.match(/PHPSESSID=([^;]+)/i);
			if (match?.[1]) {
				foundSessionId = match[1];
			}
		}

		return foundSessionId;
	}

	private isSessionExpiredResponse(data: unknown): boolean {
		if (!data || typeof data !== 'object') {
			return false;
		}

		const record = data as Record<string, unknown>;
		return (
			record.noMain === true ||
			record.redirect === 'login' ||
			record.error === 'authorize_error'
		);
	}

	private async requestWithSession<T>(
		requestFn: (sessionId: string) => Promise<AxiosResponse<T>>,
	): Promise<T> {
		let sessionId = await this.ensureSession();

		try {
			const response = await requestFn(sessionId);

			if (this.isSessionExpiredResponse(response.data)) {
				this.logger.warn(
					'Sesión del panel expirada detectada en respuesta. Renovando sesión...',
				);
				await this.invalidateSession();
				sessionId = await this.ensureSession();
				const retryResponse = await requestFn(sessionId);
				this.logger.warn(retryResponse);
				return retryResponse.data;
			}

			return response.data;
		} catch (error) {
			if (
				axios.isAxiosError(error) &&
				(error.response?.status === 302 ||
					this.isSessionExpiredResponse(error.response?.data))
			) {
				this.logger.warn('Sesión expirada detectada por error HTTP. Reintentando...');
				await this.invalidateSession();
				sessionId = await this.ensureSession();
				const retryResponse = await requestFn(sessionId);
				return retryResponse.data;
			}

			throw error;
		}
	}

	/**
	 * Search for players globally across the network by login (POST area=search&response=js).
	 */
	async searchPlayer(searchLogin: string, page = 1): Promise<LuckyBetSearchUser[]> {
		const url = `${this.panelHost}/index.php?act=admin&area=search&response=js`;

		const data = await this.requestWithSession<LuckyBetSearchResponse>(sessionId => {
			const params = new URLSearchParams();
			params.append('search_login', searchLogin);
			params.append('page', String(page));

			return this.client.post<LuckyBetSearchResponse>(url, params.toString(), {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Accept: 'application/json',
					Cookie: `PHPSESSID=${String(sessionId)}`,
				},
			});
		});

		return data.users ?? [];
	}

	/**
	 * Query player balance and historical operations data.
	 */
	async getPlayerBalance(
		userId: string | number,
		options?: LuckyBetGetBalanceOptions,
	): Promise<LuckyBetBalanceResponse> {
		const params = new URLSearchParams();
		params.append('act', 'admin');
		params.append('area', 'balance');
		params.append('id', String(userId));
		params.append('response', 'js');

		if (options?.limit) {
			params.append('limit', String(options.limit));
		}
		if (options?.offset) {
			params.append('offset', String(options.offset));
		}
		if (options?.from) {
			params.append('from', options.from);
		}
		if (options?.to) {
			params.append('to', options.to);
		}

		const url = `${this.panelHost}/index.php?${params.toString()}`;

		return await this.requestWithSession<LuckyBetBalanceResponse>((sessionId: string) => {
			return this.client.get<LuckyBetBalanceResponse>(url, {
				headers: {
					Accept: 'application/json',
					Cookie: `PHPSESSID=${String(sessionId)}`,
				},
			});
		});
	}

	/**
	 * Query player game session history (area=history&response=js).
	 */
	async getPlayerHistory(
		userId: string | number,
		options?: LuckyBetGetHistoryOptions,
	): Promise<LuckyBetHistoryResponse> {
		const params = new URLSearchParams();
		params.append('act', 'admin');
		params.append('area', 'history');
		params.append('id', String(userId));
		params.append('response', 'js');

		if (options?.session) {
			params.append('session', options.session);
		}
		if (options?.from) {
			params.append('from', options.from);
		}
		if (options?.to) {
			params.append('to', options.to);
		}
		if (options?.limit) {
			params.append('limit', String(Math.min(options.limit, 1000)));
		}

		const url = `${this.panelHost}/index.php?${params.toString()}`;

		return await this.requestWithSession<LuckyBetHistoryResponse>((sessionId: string) => {
			return this.client.get<LuckyBetHistoryResponse>(url, {
				headers: {
					Accept: 'application/json',
					Cookie: `PHPSESSID=${String(sessionId)}`,
				},
			});
		});
	}

	/**
	 * Credit balance to player (deposit / carga de fichas) with optional bonus/promocode parameters.
	 */
	async creditPlayer(
		userId: string | number,
		amount: number,
		options?: LuckyBetBalanceMutationOptions,
	): Promise<LuckyBetBalanceMutationResult> {
		const currency = options?.currency ?? 'ARS';
		const amountSent = amount;

		const url = `${this.panelHost}/index.php?act=admin&area=balance&response=js&type=frame&printing=true&id=${userId}`;

		const params = new URLSearchParams();
		params.append('balance_currency', currency);
		params.append('amount', String(amountSent));
		params.append('send', 'true');
		params.append('all', 'false');
		params.append('operation', 'in');

		if (options?.bonus !== undefined && options?.bonus !== null) {
			params.append('bonus', String(options.bonus));
		}
		if (options?.cashierBonus !== undefined && options?.cashierBonus !== null) {
			params.append('cashier_bonus', String(options.cashierBonus));
		}
		if (options?.promocode) {
			params.append('promocode', options.promocode);
			params.append('promo', options.promocode);
		}
		if (options?.balanceType) {
			params.append('balance_type', options.balanceType);
		}

		const data = await this.requestWithSession<Record<string, unknown>>(sessionId => {
			return this.client.post<Record<string, unknown>>(url, params.toString(), {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Accept: 'application/json',
					Cookie: `PHPSESSID=${String(sessionId)}`,
				},
			});
		});

		const operationId = this.extractOperationId(data.printUrl as string);

		return {
			success: !data.error && Boolean(data.successMessage || data.printUrl),
			operationId,
			currencies: data.currencies as Record<string, number | string> | undefined,
			successMessage: data.successMessage as string | undefined,
			printUrl: data.printUrl as string | undefined,
			error: (data.error || data.errorMessage) as string | undefined,
			amountRequested: amount,
			amountSent,
			bonusApplied: options?.bonus,
			promocodeApplied: options?.promocode,
		};
	}

	/**
	 * Debit balance from player (withdrawal / retiro de fichas).
	 */
	async debitPlayer(
		userId: string | number,
		amount: number,
		options?: LuckyBetBalanceMutationOptions,
	): Promise<LuckyBetBalanceMutationResult> {
		const currency = options?.currency ?? 'ARS';
		const isAll = Boolean(options?.all);
		const amountSent = isAll ? 0 : amount;

		const url = `${this.panelHost}/index.php?act=admin&area=balance&response=js&type=frame&printing=true&id=${userId}`;

		const params = new URLSearchParams();
		params.append('balance_currency', currency);
		params.append('amount', String(amountSent));
		params.append('send', 'true');
		params.append('all', isAll ? 'true' : 'false');
		params.append('operation', 'out');

		const data = await this.requestWithSession<Record<string, unknown>>(sessionId => {
			return this.client.post<Record<string, unknown>>(url, params.toString(), {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Accept: 'application/json',
					Cookie: `PHPSESSID=${String(sessionId)}`,
				},
			});
		});

		const operationId = this.extractOperationId(data.printUrl as string);

		return {
			success: !data.error && Boolean(data.successMessage || data.printUrl),
			operationId,
			currencies: data.currencies as Record<string, number | string> | undefined,
			successMessage: data.successMessage as string | undefined,
			printUrl: data.printUrl as string | undefined,
			error: (data.error || data.errorMessage) as string | undefined,
			amountRequested: amount,
			amountSent,
		};
	}

	/**
	 * Returns deduplicated played games for a user within a time period (default: 7 days),
	 * cached in Redis with a 5-minute TTL.
	 * Prioritizes native area=history session rounds with fallback to area=balance,
	 * and enriches games with CDN image URLs and providers from the game catalog.
	 */
	async getLastPlayedGames(
		userId: string | number,
		options?: GetPlayedGamesOptions,
	): Promise<PlayerGameHistoryResult> {
		const days = options?.days ?? DEFAULT_PLAYED_GAMES_DAYS;
		const limit = options?.limit ?? DEFAULT_PLAYED_GAMES_LIMIT;
		const cacheKey = `luckybet:player:recent_games:${userId}:${days}:${limit}`;

		if (!options?.forceRefresh) {
			const cached = await this.cache.get<PlayerGameHistoryResult>(cacheKey);
			if (cached) {
				return cached;
			}
		}

		const now = new Date();
		const toDateStr = this.formatDate(now);
		const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
		const fromDateStr = this.formatDate(fromDate);

		// 1. Query native area=history game session endpoint
		const historyRes = await this.getPlayerHistory(userId, {
			from: fromDateStr,
			to: toDateStr,
			limit: 1000,
		});

		const sessions = historyRes.sessions ?? historyRes.history ?? [];
		const deduplicatedGames = new Map<string, PlayedGame>();

		if (sessions.length > 0) {
			for (const item of sessions) {
				const gameIdentifier = item.game || item.game_name;
				if (!gameIdentifier) continue;

				const rawId = String(gameIdentifier);
				const betAmount = Number(item.bet ?? item.wager) || 0;
				const lastPlayedAt =
					item.datetime ||
					(item.date && item.time ? `${item.date} ${item.time}` : toDateStr);

				if (!deduplicatedGames.has(rawId)) {
					deduplicatedGames.set(rawId, {
						gameId: rawId,
						gameName: item.game_name || this.formatGameName(String(gameIdentifier)),
						lastPlayedAt,
						totalBetInPeriod: betAmount,
						playCount: 1,
					});
				} else {
					const existing = deduplicatedGames.get(rawId);
					if (existing) {
						existing.playCount = (existing.playCount || 1) + 1;
						existing.totalBetInPeriod = (existing.totalBetInPeriod || 0) + betAmount;
					}
				}
			}
		} else {
			// 2. Fallback to area=balance ledger if area=history returns empty
			const balanceData = await this.getPlayerBalance(userId, {
				from: fromDateStr,
				to: toDateStr,
				limit: 1000,
			});

			const operations = balanceData.operationsData ?? [];
			const sortedOps = [...operations].sort((a, b) => {
				const timeA = new Date(a.datetime || 0).getTime();
				const timeB = new Date(b.datetime || 0).getTime();
				return timeB - timeA;
			});

			for (const op of sortedOps) {
				const gameIdentifier =
					op.game ||
					op.bonus_game ||
					(op.system !== 'admin' && op.system !== 'usual' ? op.system : null);

				if (!gameIdentifier) {
					continue;
				}

				const rawId = String(gameIdentifier);
				const wagerAmount = Number(op.wager) || 0;
				const lastPlayedAt = op.datetime || op.date || toDateStr;

				if (!deduplicatedGames.has(rawId)) {
					deduplicatedGames.set(rawId, {
						gameId: rawId,
						gameName: this.formatGameName(rawId),
						lastPlayedAt,
						totalBetInPeriod: wagerAmount,
						playCount: 1,
					});
				} else {
					const existing = deduplicatedGames.get(rawId);
					if (existing) {
						existing.playCount = (existing.playCount || 1) + 1;
						existing.totalBetInPeriod = (existing.totalBetInPeriod || 0) + wagerAmount;
					}
				}
			}
		}

		// 3. Enrich games with catalog data (images from CDN and provider)
		const catalog = await this.cache.get<
			Array<{
				id: string | number;
				name?: string;
				title?: string;
				img?: string;
				label?: string;
			}>
		>(LUCKYBET_GAME_CATALOG_CACHE_KEY);

		if (catalog && Array.isArray(catalog)) {
			for (const game of deduplicatedGames.values()) {
				const matched = catalog.find(
					c =>
						String(c.id).toLowerCase() === game.gameId.toLowerCase() ||
						(c.name && c.name.toLowerCase() === game.gameId.toLowerCase()),
				);
				if (matched) {
					if (matched.title || matched.name) {
						game.gameName = matched.title || matched.name || game.gameName;
					}
					const providerName =
						matched.label || (matched as { provider?: string }).provider;
					if (providerName) {
						game.provider = providerName;
					}
					if (matched.img) {
						game.imageUrl = matched.img;
					}
				}
			}
		}

		const gamesList = Array.from(deduplicatedGames.values()).slice(0, limit);

		const result: PlayerGameHistoryResult = {
			userId,
			periodDays: days,
			from: fromDateStr,
			to: toDateStr,
			games: gamesList,
			totalUniqueGames: deduplicatedGames.size,
		};

		await this.cache.set(cacheKey, result, options?.ttl ?? this.gameActivityTtl);
		return result;
	}

	private formatDate(date: Date): string {
		const pad = (n: number) => String(n).padStart(2, '0');
		const y = date.getFullYear();
		const m = pad(date.getMonth() + 1);
		const d = pad(date.getDate());
		const h = pad(date.getHours());
		const min = pad(date.getMinutes());
		const s = pad(date.getSeconds());
		return `${y}-${m}-${d} ${h}:${min}:${s}`;
	}

	private formatGameName(rawName: string): string {
		return rawName.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
	}

	private extractOperationId(printUrl?: string): string | null {
		if (!printUrl) {
			return null;
		}
		const match = printUrl.match(/operation=([0-9a-zA-Z_-]+)/);
		return match ? match[1] : null;
	}
}
