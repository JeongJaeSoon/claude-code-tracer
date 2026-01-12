// Filter state from URL
export interface URLFilterState {
	project: string | null;
	dateRange: "all" | "today" | "week";
	search: string;
}

// Build URL with filters
function buildSessionsURL(filters: Partial<URLFilterState>): string {
	const params = new URLSearchParams();
	if (filters.project) params.set("project", filters.project);
	if (filters.dateRange && filters.dateRange !== "all")
		params.set("date", filters.dateRange);
	if (filters.search) params.set("search", filters.search);

	const queryString = params.toString();
	return queryString ? `sessions?${queryString}` : "sessions";
}

// Update URL without adding to history (for filter changes)
export function updateFilters(filters: Partial<URLFilterState>): void {
	const newHash = buildSessionsURL(filters);
	window.history.replaceState(null, "", `#${newHash}`);
	// Dispatch custom event for components to react
	window.dispatchEvent(new CustomEvent("filterschange", { detail: filters }));
}

// Global navigate function
export function navigate(path: string): void {
	window.location.hash = path;
}

// Update selected item in URL without navigation
export function updateSelectedItem(
	sessionId: string,
	itemId: string | null,
): void {
	const newHash = itemId
		? `session/${sessionId}/${itemId}`
		: `session/${sessionId}`;
	window.history.replaceState(null, "", `#${newHash}`);
}
