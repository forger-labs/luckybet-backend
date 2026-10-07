export interface LuckyBetResponse<T = unknown> {
	status: 'success' | 'fail';
	token?: string;
	content?: T;
	errorCode?: string;
	error?: string;
	datetime?: string;
	microtime?: number;
	[key: string]: unknown;
}

export interface LuckyBetRequest<T = unknown> {
	cmd: string;
	version: number;
	domain: string;
	type?: string;
	token?: string;
	first?: boolean;
	data?: T;
	[key: string]: unknown;
}

export interface LuckyBetTerminalInfoContent {
	id: number | string;
	login: string;
	cash?: number | string;
	currency?: string;
	group?: number | string;
	name?: string;
	language?: string;
	vipRank?: string;
	[key: string]: unknown;
}

export interface LuckyBetPlayerUser {
	id: number | string;
	login: string;
	cash: number | string;
	currency: string;
	language?: string;
	name?: string;
	group?: number | string;
}
