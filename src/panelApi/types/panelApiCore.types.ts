export interface PlayerLevelInfo {
	id?: number;
	name: string;
	image: string;
	minExperience: number;
	coins?: number;
	bonus?: string | null;
}

export interface PlayerAuthContext {
	id: number;
	username: string;
	phone?: string | null;
	isActive: boolean;
	levelId?: number | null;
	experience?: number;
	level?: PlayerLevelInfo | null;
	cash?: number;
	currency?: string;
	luckyBetId?: string | number;
	isNewlyRegistered?: boolean;
	wasReactivated?: boolean;
}

export interface AuthenticatePlayerOptions {
	forceRefresh?: boolean;
}
