import { createContext, useContext, useEffect, useRef, useState } from "react";
import { SessionDetail } from "./pages/SessionDetail.tsx";
import { SessionList } from "./pages/SessionList.tsx";

// Theme context
type Theme = "dark" | "light";

interface ThemeContextType {
	theme: Theme;
	setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
	theme: "dark",
	setTheme: () => {},
});

export function useTheme() {
	return useContext(ThemeContext);
}

// Router state - hash-based routing
type Page = "sessions" | "session";

// Filter state from URL
export interface URLFilterState {
	project: string | null;
	dateRange: "all" | "today" | "week";
	search: string;
}

interface RouterState {
	page: Page;
	sessionId?: string;
	selectedItemId?: string;
	filters: URLFilterState;
}

// Parse hash into route state (supports query params: #sessions?project=xxx&date=today)
function parseHash(hash: string): RouterState {
	const rawPath = hash.startsWith("#") ? hash.slice(1) : hash;
	const [path, queryString] = rawPath.split("?");

	// Parse query params
	const params = new URLSearchParams(queryString || "");
	const filters: URLFilterState = {
		project: params.get("project"),
		dateRange: (params.get("date") as URLFilterState["dateRange"]) || "all",
		search: params.get("search") || "",
	};

	// #session/{sessionId}/{itemId?} -> session detail
	if (path.startsWith("session/")) {
		const rest = path.slice(8); // "session/".length = 8
		const [sessionId, selectedItemId] = rest.split("/");
		if (sessionId) {
			return {
				page: "session",
				sessionId,
				selectedItemId: selectedItemId || undefined,
				filters,
			};
		}
	}

	// Default: sessions list
	return { page: "sessions", filters };
}

// Build URL with filters
export function buildSessionsURL(filters: Partial<URLFilterState>): string {
	const params = new URLSearchParams();
	if (filters.project) params.set("project", filters.project);
	if (filters.dateRange && filters.dateRange !== "all")
		params.set("date", filters.dateRange);
	if (filters.search) params.set("search", filters.search);

	const queryString = params.toString();
	return queryString ? `sessions?${queryString}` : "sessions";
}

// Update URL without adding to history (for filter changes)
export function updateFilters(filters: Partial<URLFilterState>) {
	const newHash = buildSessionsURL(filters);
	window.history.replaceState(null, "", `#${newHash}`);
	// Dispatch custom event for components to react
	window.dispatchEvent(new CustomEvent("filterschange", { detail: filters }));
}

// Global navigate function
export function navigate(path: string) {
	window.location.hash = path;
}

// Update selected item in URL without navigation
export function updateSelectedItem(sessionId: string, itemId: string | null) {
	const newHash = itemId
		? `session/${sessionId}/${itemId}`
		: `session/${sessionId}`;
	window.history.replaceState(null, "", `#${newHash}`);
}

export function App(): JSX.Element {
	const [theme, setTheme] = useState<Theme>("dark");
	const [router, setRouter] = useState<RouterState>(() =>
		parseHash(window.location.hash),
	);

	// Apply theme to document
	useEffect(() => {
		document.documentElement.dataset.theme = theme;
	}, [theme]);

	// Track last processed hash to detect external URL changes
	const lastHashRef = useRef(window.location.hash);

	// Listen for hash changes (browser back/forward, direct navigation)
	// Also poll for changes that events might miss (e.g., manual URL bar edits)
	useEffect(() => {
		const syncWithUrl = () => {
			const currentHash = window.location.hash;
			if (currentHash !== lastHashRef.current) {
				lastHashRef.current = currentHash;
				setRouter(parseHash(currentHash));
			}
		};

		window.addEventListener("hashchange", syncWithUrl);
		window.addEventListener("popstate", syncWithUrl);

		// Poll for URL changes that events might miss
		const intervalId = setInterval(syncWithUrl, 200);

		return () => {
			window.removeEventListener("hashchange", syncWithUrl);
			window.removeEventListener("popstate", syncWithUrl);
			clearInterval(intervalId);
		};
	}, []);

	return (
		<ThemeContext.Provider value={{ theme, setTheme }}>
			<div className="app">
				{router.page === "sessions" && (
					<SessionList
						onSelectSession={(id) => navigate(`session/${id}`)}
						initialFilters={router.filters}
					/>
				)}
				{router.page === "session" && router.sessionId && (
					<SessionDetail
						sessionId={router.sessionId}
						initialItemId={router.selectedItemId}
					/>
				)}
			</div>
		</ThemeContext.Provider>
	);
}
