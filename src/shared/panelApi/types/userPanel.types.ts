import type {
	LuckyBetResponse,
	LuckyBetTerminalInfoContent,
} from '@/src/types/luckybetResponse';

export interface LuckyBetLoginResponseContent {
	language?: string;
	[key: string]: unknown;
}

export interface LuckyBetGameItem {
	id: string | number;
	name?: string;
	title?: string;
	provider?: string;
	img?: string;
	category?: string;
	type?: string;
	[key: string]: unknown;
}

export interface PlayerLastPlayedGameResult {
	gameId: string | null;
	gameName: string | null;
	provider?: string | null;
	imageUrl?: string | null;
	lastPlayedAt?: string | null;
	isCurrentlyPlaying?: boolean;
}

export type LuckyBetTerminalInfoResponse = LuckyBetResponse<LuckyBetTerminalInfoContent>;

export type LuckyBetLoginResponse = LuckyBetResponse<LuckyBetLoginResponseContent>;

export type LuckyBetGameListResponse = LuckyBetResponse<
	LuckyBetGameItem[] | { games: LuckyBetGameItem[] }
>;
