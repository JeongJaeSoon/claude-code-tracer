import { useCallback, useEffect, useState } from "react";
import type { FilterState } from "../components/FilterBar";
import { FilterBar, getDefaultFilters } from "../components/FilterBar";
import type { Session } from "../types/timeline.ts";
import { formatDate, formatDuration, formatTokens } from "../utils/format.ts";

interface ProjectStats {
	projectName: string;
	projectDir: string;
	sessionCount: number;
	totalDurationMs: number;
	totalInputTokens: number;
	totalOutputTokens: number;
	totalToolCalls: number;
	lastSessionAt: string;
	firstSessionAt: string;
}

interface OverallStats {
	totalProjects: number;
	totalSessions: number;
	totalTokens: { input: number; output: number };
	totalToolCalls: number;
	avgDurationMs: number;
}

interface ProjectListProps {
	onSelectSession: (sessionId: string) => void;
}

export function ProjectList({ onSelectSession }: ProjectListProps) {
	const [projects, setProjects] = useState<ProjectStats[]>([]);
	const [stats, setStats] = useState<OverallStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [expandedProject, setExpandedProject] = useState<string | null>(null);
	const [projectSessions, setProjectSessions] = useState<
		Map<string, Session[]>
	>(new Map());
	const [loadingSessions, setLoadingSessions] = useState<string | null>(null);
	const [filters, setFilters] = useState<FilterState>(getDefaultFilters());

	// Build query string from filters
	const buildQueryString = useCallback((f: FilterState): string => {
		const params = new URLSearchParams();
		if (f.search) params.set("search", f.search);
		if (f.dateRange !== "all") params.set("dateRange", f.dateRange);
		return params.toString();
	}, []);

	// Fetch projects with filters
	const fetchData = useCallback(async () => {
		setLoading(true);
		try {
			const queryString = buildQueryString(filters);
			const projectsUrl = queryString
				? `/api/projects?${queryString}`
				: "/api/projects";

			const [projectsRes, statsRes] = await Promise.all([
				fetch(projectsUrl),
				fetch("/api/projects/stats"),
			]);

			const projectsData = await projectsRes.json();
			const statsData = await statsRes.json();

			setProjects(projectsData.projects || []);
			setStats(statsData);
		} catch (error) {
			console.error("Failed to fetch data:", error);
		} finally {
			setLoading(false);
		}
	}, [filters, buildQueryString]);

	// Refetch when filters change
	useEffect(() => {
		fetchData();
	}, [fetchData]);

	// Handle filter changes
	const handleFilterChange = useCallback((newFilters: FilterState) => {
		setFilters(newFilters);
		// Clear expanded project when filters change
		setExpandedProject(null);
		setProjectSessions(new Map());
	}, []);

	async function fetchProjectSessions(projectName: string) {
		if (projectSessions.has(projectName)) return;

		setLoadingSessions(projectName);
		try {
			const res = await fetch(
				`/api/projects/${encodeURIComponent(projectName)}/sessions`,
			);
			const data = await res.json();
			setProjectSessions((prev) =>
				new Map(prev).set(projectName, data.sessions || []),
			);
		} catch (error) {
			console.error("Failed to fetch sessions:", error);
		} finally {
			setLoadingSessions(null);
		}
	}

	function toggleProject(projectName: string) {
		if (expandedProject === projectName) {
			setExpandedProject(null);
		} else {
			setExpandedProject(projectName);
			fetchProjectSessions(projectName);
		}
	}

	function formatRelativeTime(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return "Just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return formatDate(dateStr);
	}

	return (
		<>
			<header className="main-header">
				<div className="header-left">
					<div>
						<h1 className="page-title">Projects</h1>
						<p className="page-subtitle">
							{stats
								? `${stats.totalProjects} projects, ${stats.totalSessions} sessions`
								: "Loading..."}
						</p>
					</div>
				</div>
				<div className="header-center">
					<FilterBar
						filters={filters}
						onFilterChange={handleFilterChange}
						placeholder="Search projects..."
					/>
				</div>
				<div className="header-right">
					<button className="btn btn-primary" onClick={fetchData}>
						<svg
							width="16"
							height="16"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
						Refresh
					</button>
				</div>
			</header>

			<div className="main-content">
				{/* Stats Grid */}
				{stats && (
					<div className="stats-grid">
						<div className="stat-card">
							<div className="stat-label">Projects</div>
							<div className="stat-value">{stats.totalProjects}</div>
						</div>
						<div className="stat-card">
							<div className="stat-label">Sessions</div>
							<div className="stat-value">{stats.totalSessions}</div>
						</div>
						<div className="stat-card">
							<div className="stat-label">Avg Duration</div>
							<div className="stat-value">
								{formatDuration(stats.avgDurationMs)}
							</div>
						</div>
						<div className="stat-card">
							<div className="stat-label">Total Tokens</div>
							<div className="stat-value">
								{formatTokens(
									stats.totalTokens.input + stats.totalTokens.output,
								)}
							</div>
						</div>
					</div>
				)}

				{/* Projects List */}
				<div className="projects-list">
					{loading ? (
						<div className="loading-state">Loading projects...</div>
					) : projects.length === 0 ? (
						<div className="empty-state">
							<p>No projects yet</p>
							<p className="text-secondary">
								Sessions will appear here when Claude Code sends data via Stop
								hooks
							</p>
						</div>
					) : (
						projects.map((project) => (
							<div key={project.projectName} className="project-card">
								<div
									className={`project-header ${expandedProject === project.projectName ? "expanded" : ""}`}
									onClick={() => toggleProject(project.projectName)}
								>
									<div className="project-info">
										<div className="project-icon">
											<svg
												width="20"
												height="20"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
												/>
											</svg>
										</div>
										<div className="project-details">
											<div className="project-name">{project.projectName}</div>
											<div className="project-path">{project.projectDir}</div>
										</div>
									</div>
									<div className="project-stats">
										<div className="project-stat">
											<span className="stat-number">
												{project.sessionCount}
											</span>
											<span className="stat-unit">sessions</span>
										</div>
										<div className="project-stat">
											<span className="stat-number">
												{formatDuration(project.totalDurationMs)}
											</span>
											<span className="stat-unit">total</span>
										</div>
										<div className="project-stat">
											<span className="stat-number">
												{formatTokens(
													project.totalInputTokens + project.totalOutputTokens,
												)}
											</span>
											<span className="stat-unit">tokens</span>
										</div>
										<div className="project-stat">
											<span className="stat-number">
												{project.totalToolCalls}
											</span>
											<span className="stat-unit">tools</span>
										</div>
										<div className="project-last-activity">
											{formatRelativeTime(project.lastSessionAt)}
										</div>
									</div>
									<div className="expand-icon">
										<svg
											width="20"
											height="20"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d={
													expandedProject === project.projectName
														? "M19 9l-7 7-7-7"
														: "M9 5l7 7-7 7"
												}
											/>
										</svg>
									</div>
								</div>

								{expandedProject === project.projectName && (
									<div className="project-sessions">
										{loadingSessions === project.projectName ? (
											<div className="sessions-loading">
												Loading sessions...
											</div>
										) : (
											<div className="sessions-table">
												<div className="sessions-header">
													<div>Session</div>
													<div>Started</div>
													<div>Duration</div>
													<div>Tokens</div>
													<div>Tools</div>
													<div>Agents</div>
													<div>Status</div>
												</div>
												{(projectSessions.get(project.projectName) || []).map(
													(session) => (
														<div
															key={session.id}
															className="session-row"
															onClick={() => onSelectSession(session.id)}
														>
															<div className="session-id">
																{session.id.slice(0, 18)}
															</div>
															<div className="session-date">
																{formatDate(session.startedAt)}
															</div>
															<div className="session-duration">
																{formatDuration(session.totalDurationMs)}
															</div>
															<div className="session-tokens">
																{formatTokens(
																	session.inputTokens + session.outputTokens,
																)}
															</div>
															<div className="session-tools">
																{session.toolCallCount}
															</div>
															<div className="session-agents">
																{session.subAgentCount > 0
																	? `+${session.subAgentCount}`
																	: "-"}
															</div>
															<div>
																<span
																	className={`status-badge ${session.status}`}
																>
																	<span className="status-dot"></span>
																	{session.status === "completed"
																		? "Done"
																		: session.status === "running"
																			? "Running"
																			: "Error"}
																</span>
															</div>
														</div>
													),
												)}
											</div>
										)}
									</div>
								)}
							</div>
						))
					)}
				</div>
			</div>
		</>
	);
}
