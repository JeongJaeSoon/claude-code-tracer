// Date range filter utilities for sessions and projects

/**
 * Get ISO date string threshold for filtering by date range
 */
export function getDateThreshold(dateRange: string): string | null {
	const now = new Date();
	switch (dateRange) {
		case "today":
			now.setHours(0, 0, 0, 0);
			return now.toISOString();
		case "week":
			now.setDate(now.getDate() - 7);
			return now.toISOString();
		case "month":
			now.setMonth(now.getMonth() - 1);
			return now.toISOString();
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
