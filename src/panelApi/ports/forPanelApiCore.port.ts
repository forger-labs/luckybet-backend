import type { PlayerWithoutAudit } from '@/src/players/app/dto/player.schema';
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
import type { PlayerLastPlayedGameResult } from '../types/userPanel.types';

export interface ForPanelApiCore {
	/**
	 * Authenticates a player token against LuckyBet terminalInfo,
	 * handles caching in Redis (SHA-256 hashed key), auto-registration if new,
	 * and auto-reactivation if inactive.
	 */
	authenticatePlayer(
		token: string,
		options?: AuthenticatePlayerOptions,
	): Promise<PlayerAuthContext>;

	/**
	 * Finds or creates/reactivates a local player record based on LuckyBet username.
	 */
	syncOrRegisterPlayer(
		username: string,
		phone?: string,
	): Promise<PlayerWithoutAudit & { isNew?: boolean; wasReactivated?: boolean }>;

	/**
	 * Credits balance to a player in LuckyBet (deposit / carga de fichas),
	 * supporting resolution by numeric userId or username.
	 */
	creditPlayer(
		userIdOrUsername: string | number,
		amount: number,
		options?: LuckyBetBalanceMutationOptions,
	): Promise<LuckyBetBalanceMutationResult>;

	/**
	 * Debits balance from a player in LuckyBet (withdrawal / descarga de fichas),
	 * supporting resolution by numeric userId or username and total/partial withdrawals.
	 */
	debitPlayer(
		userIdOrUsername: string | number,
		amount: number,
		options?: LuckyBetBalanceMutationOptions,
	): Promise<LuckyBetBalanceMutationResult>;

	/**
	 * Retrieves the currently active or last played game for a player token.
	 */
	getLastPlayedGame(token: string): Promise<PlayerLastPlayedGameResult | null>;

	/**
	 * Retrieves deduplicated played games for a user within a time period,
	 * cross-referencing with the game catalog (gameList) to enrich each game with CDN images.
	 */
	getLastPlayedGames(
		userIdOrUsername: string | number,
		options?: GetPlayedGamesOptions & { token?: string },
	): Promise<PlayerGameHistoryResult>;

	/**
	 * Invalidates a player's cached session in Redis.
	 */
	invalidatePlayerSession(token: string): Promise<void>;

	/**
	 * Computes the SHA-256 hash of a raw token for secure Redis cache lookup.
	 */
	hashToken(token: string): string;

	changePlayerSenior(userId: string | number, seniorName: string): Promise<boolean>;
}
