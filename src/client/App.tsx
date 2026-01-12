import { useEffect, useRef, useState } from "react";
import { ThemeProvider } from "./contexts/ThemeContext.tsx";
import { SessionDetail } from "./pages/SessionDetail.tsx";
import { SessionList } from "./pages/SessionList.tsx";
import { navigate, type URLFilterState } from "./utils/router.ts";

// Router state - hash-based routing
type Page = "sessions" | "session";

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
	if (path?.startsWith("session/")) {
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

export function App() {
	const [router, setRouter] = useState<RouterState>(() =>
		parseHash(window.location.hash),
	);

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
		<ThemeProvider>
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
		</ThemeProvider>
	);
}
