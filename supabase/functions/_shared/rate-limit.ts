type TimestampMap = Map<string, number[]>;

export function createInMemoryRateLimiter() {
	const requests: TimestampMap = new Map();

	return function checkRateLimit(
		key: string,
		maxRequests: number,
		windowMs: number,
	): boolean {
		const now = Date.now();
		const timestamps = requests.get(key) ?? [];
		const recent = timestamps.filter((ts) => now - ts < windowMs);

		if (recent.length >= maxRequests) {
			requests.set(key, recent);
			return false;
		}

		recent.push(now);
		requests.set(key, recent);
		return true;
	};
}
