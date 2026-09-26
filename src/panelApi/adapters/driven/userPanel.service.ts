import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AxiosInstance } from 'axios';
import axios from 'axios';

import type {
	LuckyBetRequest,
	LuckyBetResponse,
	LuckyBetTerminalInfoContent,
} from '@/src/types/luckybetResponse';
import { CACHE_PORT } from '../../../shared/cache/constants';
import type { ForCache } from '../../../shared/cache/ports/forCache.port';
import { LuckyBetGameItem } from '../../app/dtos/game.schema';
import {
	AXIOS_USER_PANEL,
	DEFAULT_LUCKYBET_GAME_ACTIVITY_TTL_SECONDS,
	DEFAULT_LUCKYBET_GAME_CATALOG_TTL_SECONDS,
	LUCKYBET_GAME_CATALOG_CACHE_KEY,
} from '../../constants';
import type { ForUserPanel } from '../../ports/forUserPanel.port';
import type {
	LuckyBetLoginResponse,
	LuckyBetLoginResponseContent,
	PlayerLastPlayedGameResult,
} from '../../types/userPanel.types';

@Injectable()
export class UserPanelService implements ForUserPanel {
	private readonly apiUrl: string;
	private readonly domain: string;
	private readonly version: number;
	private readonly gameActivityTtl: number;
	private readonly gameCatalogTtl: number;
	private readonly headers = {
		'Content-Type': 'application/json',
		Accept: 'application/json',
	};

	constructor(
		config: ConfigService,
		@Inject(CACHE_PORT)
		private readonly cache: ForCache,
		@Inject(AXIOS_USER_PANEL)
		private readonly client: AxiosInstance,
	) {
		const baseUrl =
			config.get<string>('LUCKYBET_API_BASE') ??
			config.get<string>('PANEL_API_URL') ??
			'https://api.luckybet.site';

		this.apiUrl = baseUrl.includes('?') ? baseUrl : `${baseUrl}/?act=command&area=cmd`;
		this.domain =
			config.get<string>('LUCKYBET_DOMAIN') ??
			config.get<string>('PANEL_DOMAIN') ??
			'luckybet.site';
		this.version = Number(
			config.get<number | string>('LUCKYBET_API_VERSION') ??
				config.get<number | string>('PANEL_VERSION') ??
				9,
		);
		this.gameActivityTtl = Number(
			config.get<number | string>(
				'LUCKYBET_GAME_ACTIVITY_TTL_SECONDS',
				DEFAULT_LUCKYBET_GAME_ACTIVITY_TTL_SECONDS,
			),
		);
		this.gameCatalogTtl = Number(
			config.get<number | string>(
				'LUCKYBET_GAME_CATALOG_TTL_SECONDS',
				DEFAULT_LUCKYBET_GAME_CATALOG_TTL_SECONDS,
			),
		);
	}

	/**
	 * Executes a command against the LuckyBet player API endpoint.
	 */
	async executeCommand<TResContent = unknown>(
		cmd: string,
		payload: Record<string, unknown> = {},
	): Promise<LuckyBetResponse<TResContent>> {
		const body: LuckyBetRequest = {
			cmd,
			version: this.version,
			domain: this.domain,
			...payload,
		};

		try {
			const response = await this.client.post<LuckyBetResponse<TResContent>>(
				this.apiUrl,
				body,
				{
					headers: {
						...this.headers,
					},
				},
			);
			return response.data;
		} catch (error) {
			if (axios.isAxiosError(error) && error.response?.data) {
				return error.response.data as LuckyBetResponse<TResContent>;
			}

			return {
				status: 'fail',
				errorCode: 'network_error',
				error: 'Error de conexión con el servidor de LuckyBet.',
			};
		}
	}

	/**
	 * Checks token validity and retrieves player terminal/profile info.
	 * Valid: { status: "success", content: { id, login, cash, currency, ... } }
	 * Invalid: { status: "fail", errorCode: "authorize_error", error: "..." }
	 */
	async terminalInfo(
		token: string,
		first = false,
	): Promise<LuckyBetResponse<LuckyBetTerminalInfoContent>> {
		return await this.executeCommand<LuckyBetTerminalInfoContent>('terminalInfo', {
			token,
			first,
		});
	}

	/**
	 * Authenticates a player using login and password.
	 */
	async login(login: string, password: string): Promise<LuckyBetLoginResponse> {
		return await this.executeCommand<LuckyBetLoginResponseContent>('authorization', {
			type: 'login',
			data: {
				login,
				password,
			},
		});
	}

	/**
	 * Retrieves the LuckyBet game catalog, cached in Redis with a 1-hour TTL.
	 */
	async getGameList(token?: string): Promise<LuckyBetGameItem[]> {
		const cached = await this.cache.get<LuckyBetGameItem[]>(
			LUCKYBET_GAME_CATALOG_CACHE_KEY,
		);
		// if (cached && Array.isArray(cached) && cached.length > 0) {
		// 	return cached;
		// }

		const response = await this.executeCommand<
			LuckyBetGameItem[] | { gameList?: LuckyBetGameItem[]; list?: LuckyBetGameItem[] }
		>('gameList', token ? { token } : {});
console.log(response)
		let games: LuckyBetGameItem[] = [];

		if (response.status === 'success' && response.content) {
			if (Array.isArray(response.content)) {
				games = response.content;
			} else if (
				!Array.isArray(response.content) &&
				response.content.gameList &&
				Array.isArray(response.content.gameList)
			) {
				games = response.content.gameList;
			} else if (Array.isArray(response.content.list)) {
				games = response.content.list;
			}
		}

		if (games.length > 0) {
			await this.cache.set(LUCKYBET_GAME_CATALOG_CACHE_KEY, games, this.gameCatalogTtl);
		}

		return games;
	}

	/**
	 * Returns the last played or currently active game for a player token,
	 * cached in Redis with a 5-minute TTL.
	 */
	async getLastPlayedGame(token: string): Promise<PlayerLastPlayedGameResult | null> {
		const terminalRes = await this.terminalInfo(token);

		if (terminalRes.status !== 'success' || !terminalRes.content?.id) {
			return null;
		}

		const playerId = String(terminalRes.content.id);
		const cacheKey = `luckybet:player:last_game:${playerId}`;

		const cached = await this.cache.get<PlayerLastPlayedGameResult>(cacheKey);
		if (cached) {
			return cached;
		}

		const content = terminalRes.content;
		const rawGameId =
			content.game ||
			content.bonus_game ||
			(content as Record<string, unknown>).last_game;

		if (!rawGameId) {
			const emptyResult: PlayerLastPlayedGameResult = {
				gameId: null,
				gameName: null,
				isCurrentlyPlaying: false,
				lastPlayedAt: null,
			};
			await this.cache.set(cacheKey, emptyResult, this.gameActivityTtl);
			return emptyResult;
		}

		const gameIdStr = String(rawGameId);
		const catalog = await this.getGameList(token);
		const matched = catalog.find(g => String(g.id) === gameIdStr || g.name === gameIdStr);

		const result: PlayerLastPlayedGameResult = {
			gameId: gameIdStr,
			gameName: matched?.title || matched?.name || gameIdStr,
			provider: matched?.provider || null,
			imageUrl: matched?.img || null,
			lastPlayedAt: ((content as Record<string, unknown>).last as string) || null,
			isCurrentlyPlaying: Boolean(content.game),
		};

		await this.cache.set(cacheKey, result, this.gameActivityTtl);
		return result;
	}
}
