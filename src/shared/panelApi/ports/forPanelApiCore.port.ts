import type { PlayerWithoutAudit } from '@/src/players/app/dto/player.schema';
import type {
	AuthenticatePlayerOptions,
	PlayerAuthContext,
} from '../types/panelApiCore.types';

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
	 * Invalidates a player's cached session in Redis.
	 */
	invalidatePlayerSession(token: string): Promise<void>;

	/**
	 * Computes the SHA-256 hash of a raw token for secure Redis cache lookup.
	 */
	hashToken(token: string): string;
}
