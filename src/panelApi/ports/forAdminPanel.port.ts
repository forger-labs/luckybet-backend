import type {
	GetPlayedGamesOptions,
	LuckyBetBalanceMutationOptions,
	LuckyBetBalanceMutationResult,
	LuckyBetBalanceResponse,
	LuckyBetGetBalanceOptions,
	LuckyBetGetHistoryOptions,
	LuckyBetHistoryResponse,
	LuckyBetSearchUser,
	PlayerGameHistoryResult,
} from '../types/adminPanel.types';

export interface ForAdminPanel {
	/**
	 * Search for players globally across the network by login.
	 */
	searchPlayer(searchLogin: string, page?: number): Promise<LuckyBetSearchUser[]>;

	/**
	 * Query player balance and historical operations data.
	 */
	getPlayerBalance(
		userId: string | number,
		options?: LuckyBetGetBalanceOptions,
	): Promise<LuckyBetBalanceResponse>;

	changePlayerSenior(
		userId: string | number,
		seniorName: string,
	): Promise<boolean>;

	/**
	 * Retrieves the current senior/room login of a player via area=useredit.
	 */
	getPlayerSenior(userId: string | number): Promise<string | null>

	/**
	 * Query player game session history (area=history).
	 */
	getPlayerHistory(
		userId: string | number,
		options?: LuckyBetGetHistoryOptions,
	): Promise<LuckyBetHistoryResponse>;

	/**
	 * Credit balance to player (deposit / carga de fichas).
	 */
	creditPlayer(
		userId: string | number,
		amount: number,
		options?: LuckyBetBalanceMutationOptions,
	): Promise<LuckyBetBalanceMutationResult>;

	/**
	 * Debit balance from player (withdrawal / retiro de fichas).
	 */
	debitPlayer(
		userId: string | number,
		amount: number,
		options?: LuckyBetBalanceMutationOptions,
	): Promise<LuckyBetBalanceMutationResult>;

	/**
	 * Returns deduplicated played games for a user within a time period (default: 7 days),
	 * cached in Redis with a 5-minute TTL.
	 */
	getLastPlayedGames(
		userId: string | number,
		options?: GetPlayedGamesOptions,
	): Promise<PlayerGameHistoryResult>;

	/**
	 * Ensure an active authenticated PHPSESSID exists in Redis or login.
	 */
	ensureSession(): Promise<string>;

	/**
	 * Invalidate current session stored in Redis.
	 */
	invalidateSession(): Promise<void>;
}
