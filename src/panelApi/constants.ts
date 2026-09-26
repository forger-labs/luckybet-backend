export const AXIOS_INSTANCE = Symbol('AXIOS_INSTANCE');
export const AXIOS_ADMIN_PANEL = Symbol('AXIOS_ADMIN_PANEL');
export const AXIOS_USER_PANEL = Symbol('AXIOS_USER_PANEL');

export const FOR_ADMIN_PANEL = Symbol('FOR_ADMIN_PANEL');
export const FOR_USER_PANEL = Symbol('FOR_USER_PANEL');
export const FOR_PANEL_API_CORE = Symbol('FOR_PANEL_API_CORE');

export const LUCKYBET_ADMIN_SESSION_CACHE_KEY = 'luckybet:admin:phpsessid';
export const LUCKYBET_GAME_CATALOG_CACHE_KEY = 'luckybet:catalog:game_list';
export const LUCKYBET_PROVIDERS_CACHE_KEY = 'luckybet:catalog:providers';
export const LUCKYBET_BEFORE_TOKEN_CACHE_KEY = 'luckybet:auth:before_token';
export const LUCKYBET_PLAYER_SESSION_KEY_PREFIX = 'luckybet:session:token:';

export const DEFAULT_LUCKYBET_SESSION_TTL_SECONDS = 240; // 4 minutes
export const DEFAULT_LUCKYBET_GAME_ACTIVITY_TTL_SECONDS = 300; // 5 minutes
export const DEFAULT_LUCKYBET_GAME_CATALOG_TTL_SECONDS = 86_400; // 24 hours
export const DEFAULT_LUCKYBET_PROVIDERS_TTL_SECONDS = 86_400; // 24 hours
export const DEFAULT_LUCKYBET_BEFORE_TOKEN_TTL_SECONDS = 86_400; // 24 hours
export const DEFAULT_PLAYER_TOKEN_SESSION_TTL_SECONDS = 300; // 2 minutes (token session in Redis)
export const DEFAULT_PLAYED_GAMES_DAYS = 7;
export const DEFAULT_PLAYED_GAMES_LIMIT = 10;
