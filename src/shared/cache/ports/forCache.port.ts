export interface ForCache {
	get<T = unknown>(key: string): Promise<T | null>;
	set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
	del(key: string): Promise<void>;
	exists(key: string): Promise<boolean>;
	ttl(key: string): Promise<number>;
}
