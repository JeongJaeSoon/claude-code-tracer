import { useCallback, useEffect, useState } from "react";
import { type Project, ProjectSidebar } from "../components/ProjectSidebar.tsx";
import { type URLFilterState, updateFilters } from "../utils/router.ts";
import { SessionHeader } from "../components/SessionHeader.tsx";
import type { Session } from "../types/timeline.ts";
import {
	formatDate,
	formatDuration,
	formatSessionId,
	formatTokens,
} from "../utils/format.ts";

// Clean up prompt text for display
function cleanPrompt(text: string): string | null {
	// Strip XML/HTML-like tags
	const cleaned = text.replace(/<[^>]+>/g, "").trim();

	// Skip system messages that aren't real prompts
	if (
		cleaned.startsWith("Caveat:") ||
		cleaned.startsWith("Warmup") ||
		cleaned.length < 3
	) {
		return null;
	}

	return cleaned;
}

interface Stats {
	totalSessions: number;
	totalTokens: { input: number; output: number; cacheRead: number };
	totalToolCalls: number;
	avgDurationMs: number;
}

type DateFilter = "all" | "today" | "week";

interface SessionListProps {
	onSelectSession: (sessionId: string) => void;
	initialFilters: URLFilterState;
}

export function SessionList({
	onSelectSession,
	initialFilters,
}: SessionListProps): JSX.Element {
	const [sessions, setSessions] = useState<Session[]>([]);
	const [stats, setStats] = useState<Stats | null>(null);
	const [loading, setLoading] = useState(true);
	const [dateFilter, setDateFilter] = useState<DateFilter>(
		initialFilters.dateRange,
	);
	const [searchQuery, setSearchQuery] = useState(initialFilters.search);

	// Project state
	const [projects, setProjects] = useState<Project[]>([]);
	const [projectsLoading, setProjectsLoading] = useState(true);
	const [selectedProject, setSelectedProject] = useState<string | null>(
		initialFilters.project,
	);

	// Sync state changes to URL
	const syncToURL = useCallback(
		(project: string | null, date: DateFilter, search: string) => {
			updateFilters({
				project,
				dateRange: date,
				search,
			});
		},
		[],
	);

	// Wrapper functions to update state and URL together
	const handleProjectChange = useCallback(
		(project: string | null) => {
			setSelectedProject(project);
			syncToURL(project, dateFilter, searchQuery);
		},
		[dateFilter, searchQuery, syncToURL],
	);

	const handleDateFilterChange = useCallback(
		(date: DateFilter) => {
			setDateFilter(date);
			syncToURL(selectedProject, date, searchQuery);
		},
		[selectedProject, searchQuery, syncToURL],
	);

	const _handleSearchChange = useCallback((search: string) => {
		setSearchQuery(search);
	}, []);

	// Memoized fetch functions
	const fetchProjects = useCallback(async () => {
		try {
			setProjectsLoading(true);
			const res = await fetch("/api/projects");
			const data = await res.json();
			setProjects(data.projects || []);
		} catch (error) {
			console.error("Failed to fetch projects:", error);
		} finally {
			setProjectsLoading(false);
		}
	}, []);

	const fetchSessions = useCallback(async () => {
		try {
			setLoading(true);
			const params = new URLSearchParams();
			if (dateFilter !== "all") {
				params.set("dateRange", dateFilter);
			}
			if (searchQuery) {
				params.set("search", searchQuery);
			}

			// Determine API endpoint based on selected project
			const sessionsUrl = selectedProject
				? `/api/projects/${encodeURIComponent(selectedProject)}/sessions?${params.toString()}`
				: `/api/sessions?${params.toString()}`;

			const [sessionsRes, statsRes] = await Promise.all([
				fetch(sessionsUrl),
				fetch("/api/sessions/stats"),
			]);

			const sessionsData = await sessionsRes.json();
			const statsData = await statsRes.json();

			setSessions(sessionsData.sessions || []);
			setStats(statsData);
		} catch (error) {
			console.error("Failed to fetch data:", error);
		} finally {
			setLoading(false);
		}
	}, [selectedProject, dateFilter, searchQuery]);

	const _handleSearchSubmit = useCallback(() => {
		syncToURL(selectedProject, dateFilter, searchQuery);
		fetchSessions();
	}, [selectedProject, dateFilter, searchQuery, syncToURL, fetchSessions]);

	// Fetch projects on mount
	useEffect(() => {
		fetchProjects();
	}, [fetchProjects]);

	// Fetch sessions when dependencies change
	useEffect(() => {
		fetchSessions();
	}, [fetchSessions]);

	return (
		<div className="session-list-page">
			<SessionHeader
				stats={{
					durationMs: stats?.avgDurationMs ?? 0,
					tokens: stats
						? stats.totalTokens.input + stats.totalTokens.output
						: 0,
					toolCalls: stats?.totalToolCalls ?? 0,
				}}
			/>

			<div className="session-list-body">
				<ProjectSidebar
					projects={projects}
					selectedProject={selectedProject}
					onSelectProject={handleProjectChange}
					loading={projectsLoading}
				/>

				<div className="main-content">
					{/* Filter Chips */}
					<div className="filter-chips">
						{/* Date filters */}
						<button
							className={`filter-chip ${dateFilter === "all" ? "active" : ""}`}
							onClick={() => handleDateFilterChange("all")}
						>
							All Sessions
						</button>
						<button
							className={`filter-chip ${dateFilter === "today" ? "active" : ""}`}
							onClick={() => handleDateFilterChange("today")}
						>
							Today
						</button>
						<button
							className={`filter-chip ${dateFilter === "week" ? "active" : ""}`}
							onClick={() => handleDateFilterChange("week")}
						>
							This Week
						</button>
					</div>

					{/* Sessions Table */}
					<div className="sessions-table">
						<div className="table-header">
							<div>Session</div>
							<div>Started</div>
							<div>Duration</div>
							<div>Tokens</div>
							<div>Tools</div>
						</div>

						{loading ? (
							<div className="loading-state">Loading sessions...</div>
						) : sessions.length === 0 ? (
							<div className="empty-state">
								<p>No sessions yet</p>
								<p className="text-secondary">
									Sessions will appear here when Claude Code sends data via Stop
									hooks
								</p>
							</div>
						) : (
							sessions.map((session) => (
								<div
									key={session.id}
									className="table-row"
									onClick={() => onSelectSession(session.id)}
								>
									<div className="session-info">
										<div className="session-prompt">
											{(session.firstPrompt &&
												cleanPrompt(session.firstPrompt)) ||
												session.projectName}
										</div>
										<div className="session-id">
											{formatSessionId(session.id, "short")}
										</div>
									</div>
									<div className="session-timestamp">
										{formatDate(session.startedAt)}
									</div>
									<div className="session-duration">
										{formatDuration(session.totalDurationMs)}
									</div>
									<div className="session-tokens">
										{formatTokens(session.inputTokens + session.outputTokens)}
									</div>
									<div className="session-tools">
										<div className="tools-dots">
											{(session.toolTypes || []).slice(0, 5).map((tool) => (
												<div
													key={tool}
													className="tool-dot"
													style={{
														background: `var(--tool-${tool.toLowerCase()}, var(--text-muted))`,
													}}
													title={tool}
												/>
											))}
										</div>
										<span className="tools-count">{session.toolCallCount}</span>
									</div>
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
