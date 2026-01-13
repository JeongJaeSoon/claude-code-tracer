// Date range filter utilities for sessions and projects

/**
 * Get ISO date string threshold for filtering by date range
 * Used by DbRepository for SQL queries
 */
export function getDateThreshold(dateRange: string): string | null {
	const date = getDateThresholdAsDate(dateRange);
	return date ? date.toISOString() : null;
}

/**
 * Get Date object threshold for filtering by date range
 * Used by MemoryRepository for in-memory filtering
 */
export function getDateThresholdAsDate(dateRange: string): Date | null {
	const now = new Date();
	switch (dateRange) {
		case "today":
			now.setHours(0, 0, 0, 0);
			return now;
		case "week":
			now.setDate(now.getDate() - 7);
			return now;
		case "month":
			now.setMonth(now.getMonth() - 1);
			return now;
		default:
			return null;
	}
}

/**
 * Get duration range in milliseconds for filtering sessions
 */
export function getDurationRange(
	duration: string,
): { min: number; max: number } | null {
	switch (duration) {
		case "fast":
			return { min: 0, max: 30000 }; // < 30s
		case "normal":
			return { min: 30000, max: 300000 }; // 30s - 5m
		case "slow":
			return { min: 300000, max: Number.MAX_SAFE_INTEGER }; // > 5m
		default:
			return null;
	}
}
