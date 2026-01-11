import { useEffect, useState } from "react";
import type { Session } from "../types/timeline.ts";
import {
	formatDate,
	formatDuration,
	formatSessionId,
	formatTokens,
} from "../utils/format.ts";

interface Stats {
	totalSessions: number;
	totalTokens: { input: number; output: number; cacheRead: number };
	totalToolCalls: number;
	avgDurationMs: number;
}

type DateFilter = "all" | "today" | "week";
type ToolFilter = "Bash" | "Read" | "Edit" | "Task";

interface SessionListProps {
	onSelectSession: (sessionId: string) => void;
}

export function SessionList({ onSelectSession }: SessionListProps) {
	const [sessions, setSessions] = useState<Session[]>([]);
	const [stats, setStats] = useState<Stats | null>(null);
	const [loading, setLoading] = useState(true);
	const [dateFilter, setDateFilter] = useState<DateFilter>("all");
	const [toolFilters, setToolFilters] = useState<Set<ToolFilter>>(new Set());
	const [searchQuery, setSearchQuery] = useState("");

	useEffect(() => {
		fetchData();
	}, [dateFilter]);

	async function fetchData() {
		try {
			const params = new URLSearchParams();
			if (dateFilter !== "all") {
				params.set("dateRange", dateFilter);
			}
			if (searchQuery) {
				params.set("search", searchQuery);
			}

			const [sessionsRes, statsRes] = await Promise.all([
				fetch(`/api/sessions?${params.toString()}`),
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
	}

	function toggleToolFilter(tool: ToolFilter) {
		const newFilters = new Set(toolFilters);
		if (newFilters.has(tool)) {
			newFilters.delete(tool);
		} else {
			newFilters.add(tool);
		}
		setToolFilters(newFilters);
	}

	// Filter sessions by tool types (client-side for now)
	const filteredSessions = sessions.filter((session) => {
		if (toolFilters.size === 0) return true;
		// TODO: When toolTypes is available from API, use it
		return true;
	});

	return (
		<div className="session-list-page">
			<header className="main-header">
				<div>
					<h1 className="page-title">Sessions</h1>
					<p className="page-subtitle">
						{stats ? `${stats.totalSessions} sessions traced` : "Loading..."}
					</p>
				</div>
				<div className="header-actions">
					<div className="search-box">
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
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
						<input
							type="text"
							placeholder="Search sessions..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && fetchData()}
						/>
						<span className="search-kbd">⌘K</span>
					</div>
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
							<div className="stat-label">Total Sessions</div>
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
						<div className="stat-card">
							<div className="stat-label">Tool Calls</div>
							<div className="stat-value">
								{formatTokens(stats.totalToolCalls)}
							</div>
						</div>
					</div>
				)}

				{/* Filter Chips */}
				<div className="filter-chips">
					{/* Date filters */}
					<button
						className={`filter-chip ${dateFilter === "all" ? "active" : ""}`}
						onClick={() => setDateFilter("all")}
					>
						All Sessions
					</button>
					<button
						className={`filter-chip ${dateFilter === "today" ? "active" : ""}`}
						onClick={() => setDateFilter("today")}
					>
						Today
					</button>
					<button
						className={`filter-chip ${dateFilter === "week" ? "active" : ""}`}
						onClick={() => setDateFilter("week")}
					>
						This Week
					</button>

					<div className="filter-divider" />

					{/* Tool filters */}
					<button
						className={`filter-chip ${toolFilters.has("Bash") ? "active" : ""}`}
						onClick={() => toggleToolFilter("Bash")}
					>
						<span
							className="chip-dot"
							style={{ background: "var(--tool-bash)" }}
						/>
						Bash
					</button>
					<button
						className={`filter-chip ${toolFilters.has("Task") ? "active" : ""}`}
						onClick={() => toggleToolFilter("Task")}
					>
						<span
							className="chip-dot"
							style={{ background: "var(--tool-task)" }}
						/>
						Task (Sub-agent)
					</button>
					<button
						className={`filter-chip ${toolFilters.has("Edit") ? "active" : ""}`}
						onClick={() => toggleToolFilter("Edit")}
					>
						<span
							className="chip-dot"
							style={{ background: "var(--tool-edit)" }}
						/>
						Edit
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
						<div>Status</div>
					</div>

					{loading ? (
						<div className="loading-state">Loading sessions...</div>
					) : filteredSessions.length === 0 ? (
						<div className="empty-state">
							<p>No sessions yet</p>
							<p className="text-secondary">
								Sessions will appear here when Claude Code sends data via Stop
								hooks
							</p>
						</div>
					) : (
						filteredSessions.map((session) => (
							<div
								key={session.id}
								className="table-row"
								onClick={() => onSelectSession(session.id)}
							>
								<div className="session-info">
									<div className="session-project">{session.projectName}</div>
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
								<div className="session-tools">{session.toolCallCount}</div>
								<div>
									<span className={`status-badge ${session.status}`}>
										<span className="status-dot"></span>
										{session.status === "completed"
											? "Complete"
											: session.status === "running"
												? "Running"
												: "Error"}
									</span>
								</div>
							</div>
						))
					)}
				</div>
			</div>

			<style>{`
        .session-list-page {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100%;
          background: var(--bg-primary);
        }

        .main-header {
          padding: var(--space-lg) var(--space-xl);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .page-title {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .page-subtitle {
          font-size: 13px;
          color: var(--text-tertiary);
          margin-top: 2px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: var(--space-sm) var(--space-md);
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          min-width: 240px;
        }

        .search-box input {
          flex: 1;
          border: none;
          background: transparent;
          color: var(--text-primary);
          font-size: 13px;
          outline: none;
        }

        .search-box input::placeholder {
          color: var(--text-muted);
        }

        .search-kbd {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          background: var(--bg-hover);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-xs);
          padding: var(--space-sm) var(--space-md);
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-weight: 500;
          border: none;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .btn-primary {
          background: var(--accent-primary);
          color: white;
        }

        .btn-primary:hover {
          background: var(--accent-primary-hover);
        }

        .main-content {
          flex: 1;
          padding: var(--space-xl);
          padding-bottom: var(--space-2xl);
          overflow-y: auto;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--space-md);
          margin-bottom: var(--space-xl);
        }

        .stat-card {
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: var(--space-lg);
          transition: all var(--transition-fast);
        }

        .stat-card:hover {
          border-color: var(--border-default);
          box-shadow: var(--shadow-md);
        }

        .stat-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          margin-bottom: var(--space-xs);
        }

        .stat-value {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.02em;
          font-feature-settings: 'tnum';
        }

        .sessions-table {
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .table-header {
          display: grid;
          grid-template-columns: 1fr 140px 100px 80px 60px 100px;
          gap: var(--space-md);
          padding: var(--space-md) var(--space-lg);
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-subtle);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-tertiary);
        }

        .table-row {
          display: grid;
          grid-template-columns: 1fr 140px 100px 80px 60px 100px;
          gap: var(--space-md);
          padding: var(--space-md) var(--space-lg);
          border-bottom: 1px solid var(--border-subtle);
          align-items: center;
          transition: all var(--transition-fast);
          cursor: pointer;
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .table-row:hover {
          background: var(--bg-hover);
        }

        .session-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .session-project {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .session-id {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
        }

        .session-timestamp {
          font-size: 13px;
          color: var(--text-secondary);
        }

        .session-duration {
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
        }

        .session-tokens {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-secondary);
        }

        .session-tools {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-secondary);
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }

        .status-badge.completed {
          background: rgba(34, 197, 94, 0.15);
          color: var(--success);
        }

        .status-badge.error {
          background: rgba(239, 68, 68, 0.15);
          color: var(--error);
        }

        .status-badge.running {
          background: rgba(59, 130, 246, 0.15);
          color: var(--info);
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .status-badge.running .status-dot {
          animation: pulse 1.5s infinite;
        }

        .loading-state, .empty-state {
          padding: var(--space-2xl);
          text-align: center;
          color: var(--text-tertiary);
        }

        .empty-state p {
          margin-bottom: var(--space-sm);
        }

        /* Filter Chips */
        .filter-chips {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          margin-bottom: var(--space-lg);
          flex-wrap: wrap;
        }

        .filter-chip {
          display: inline-flex;
          align-items: center;
          gap: var(--space-xs);
          padding: var(--space-sm) var(--space-md);
          background: var(--bg-tertiary);
          border: 1px solid var(--border-subtle);
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: var(--font-sans);
        }

        .filter-chip:hover {
          border-color: var(--border-default);
          color: var(--text-primary);
        }

        .filter-chip.active {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          color: white;
        }

        .chip-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .filter-divider {
          width: 1px;
          height: 20px;
          background: var(--border-subtle);
          margin: 0 var(--space-xs);
        }
      `}</style>
		</div>
	);
}
