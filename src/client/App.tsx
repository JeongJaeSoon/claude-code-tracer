import { createContext, useContext, useEffect, useState } from "react";
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

	// #session/{id} -> session detail
	if (path.startsWith("session/")) {
		const sessionId = path.slice(8); // "session/".length = 8
		if (sessionId) {
			return { page: "session", sessionId, filters };
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

export function App(): JSX.Element {
	const [theme, setTheme] = useState<Theme>("dark");
	const [router, setRouter] = useState<RouterState>(() =>
		parseHash(window.location.hash),
	);

	// Apply theme to document
	useEffect(() => {
		document.documentElement.dataset.theme = theme;
	}, [theme]);

	// Listen for hash changes (browser back/forward, direct navigation)
	useEffect(() => {
		const handleHashChange = () => {
			setRouter(parseHash(window.location.hash));
		};

		window.addEventListener("hashchange", handleHashChange);
		return () => window.removeEventListener("hashchange", handleHashChange);
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
					<SessionDetail sessionId={router.sessionId} />
				)}
			</div>

			<style>{`
        .app {
          display: flex;
          min-height: 100vh;
          width: 100vw;
          background: var(--bg-primary);
        }
      `}</style>
		</ThemeContext.Provider>
	);
}
