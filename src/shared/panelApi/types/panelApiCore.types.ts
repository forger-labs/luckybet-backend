export interface PlayerAuthContext {
	id: number;
	username: string;
	phone?: string | null;
	isActive: boolean;
	levelId?: number | null;
	cash?: number;
	currency?: string;
	luckyBetId?: string | number;
	isNewlyRegistered?: boolean;
	wasReactivated?: boolean;
}

export interface AuthenticatePlayerOptions {
	forceRefresh?: boolean;
}
