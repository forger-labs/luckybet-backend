import type {
	LuckyBetResponse,
	LuckyBetTerminalInfoContent,
} from '@/src/types/luckybetResponse';
import { LuckyBetGameItem } from '../app/dtos/game.schema';
import type {
	LuckyBetLoginResponse,
	PlayerLastPlayedGameResult,
} from '../types/userPanel.types';

export interface ForUserPanel {
	/**
	 * Executes any command against the LuckyBet player JSON API.
	 */
	executeCommand<TResContent = unknown>(
		cmd: string,
		payload?: Record<string, unknown>,
	): Promise<LuckyBetResponse<TResContent>>;

	/**
	 * Validates player access token and returns player terminal profile.
	 */
	terminalInfo(
		token: string,
		first?: boolean,
	): Promise<LuckyBetResponse<LuckyBetTerminalInfoContent>>;

	/**
	 * Authenticates a player with login and password against LuckyBet player API.
	 */
	login(login: string, password: string): Promise<LuckyBetLoginResponse>;

	/**
	 * Initializes site session to obtain before_token for public operations.
	 */
	siteInitialize(): Promise<string>;

	/**
	 * Retrieves the LuckyBet game catalog, cached in Redis with a 24-hour TTL.
	 */
	getGameList(token?: string): Promise<LuckyBetGameItem[]>;

	/**
	 * Returns the last played or currently active game for a player token,
	 * cached in Redis with a 5-minute TTL.
	 */
	getLastPlayedGame(token: string): Promise<PlayerLastPlayedGameResult | null>;
}
