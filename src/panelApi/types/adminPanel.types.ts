import type { BonusIntern } from '@/src/types/bonus';

export interface LuckyBetSearchUser {
	id: string | number;
	login: string;
	group?: string | number;
	name?: string;
	weight?: string | number;
	create?: string | number;
	additional?: unknown[];
	[key: string]: unknown;
}

export interface LuckyBetSearchResponse {
	search?: string;
	users?: LuckyBetSearchUser[];
	next_page_enable?: boolean;
	prev_page_enable?: boolean;
	page_start_num?: number;
	page_end_num?: number;
	main?: Record<string, unknown>;
	editUser?: Record<string, unknown>;
	error?: string;
	errorMessage?: string;
	[key: string]: unknown;
}

export interface LuckyBetOperationData {
	id: number | string;
	user: number | string;
	from?: string;
	uid?: number | string;
	operation: 'in' | 'out' | string;
	currency: string;
	cash: number | string;
	cash_before?: number | string;
	datetime: string;
	system?: string;
	initiator?: string;
	wager?: number | string;
	ip?: string;
	cash_in?: number | string;
	cash_out?: number | string;
	cashier_bonus?: number | string;
	date?: string;
	time?: string;
	game?: string;
	bonus_game?: string;
	bonus_session?: string;
	[key: string]: unknown;
}

export interface LuckyBetBalanceResponse {
	currencies: Record<string, number | string>;
	operationsData: LuckyBetOperationData[];
	sum?: Record<string, unknown>;
	limits?: Record<string, unknown>;
	pageCount?: number;
	limit?: number;
	offset?: number;
	error?: string;
	errorMessage?: string;
	[key: string]: unknown;
}

export interface LuckyBetBalanceMutationResult {
	success: boolean;
	operationId?: string | null;
	currencies?: Record<string, number | string>;
	successMessage?: string;
	printUrl?: string;
	error?: string;
	errorMessage?: string;
	amountRequested?: number;
	amountSent?: number;
	bonusApplied?: number | string | BonusIntern;
	promocodeApplied?: string;
}

export interface LuckyBetBalanceMutationOptions {
	currency?: string;
	all?: boolean;
	bonus?: number | string | BonusIntern;
	cashierBonus?: number | string;
	promocode?: string;
	balanceType?: string;
}

export interface LuckyBetGetBalanceOptions {
	from?: string;
	to?: string;
	limit?: number;
	offset?: number;
}

export interface PlayedGame {
	gameId: string;
	gameName: string;
	provider?: string;
	imageUrl?: string;
	lastPlayedAt: string;
	totalBetInPeriod?: number;
	playCount?: number;
}

export interface GetPlayedGamesOptions {
	from?: string;
	to?: string;
	days?: number;
	limit?: number;
	provider?: string;
	gameName?: string;
  forceRefresh?: boolean;
	ttl?: number
}

export interface PlayerGameHistoryResult {
	userId: string | number;
	periodDays: number;
	from: string;
	to: string;
	games: PlayedGame[];
	totalUniqueGames: number;
}

export interface LuckyBetHistorySessionItem {
	id?: string | number;
	game?: string;
	game_name?: string;
	datetime?: string;
	date?: string;
	time?: string;
	wager?: number | string;
	win?: number | string;
	bet?: string | number;
	session?: string;
	[key: string]: unknown;
}

export interface LuckyBetGetHistoryOptions {
	session?: string;
	from?: string;
	to?: string;
	limit?: number;
}

export interface LuckyBetHistoryResponse {
	sessions?: LuckyBetHistorySessionItem[];
	history?: LuckyBetHistorySessionItem[];
	dataList?: unknown[];
	error?: string;
	errorMessage?: string;
	[key: string]: unknown;
}
