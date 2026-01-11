import type { ReactElement } from "react";

export interface Project {
	projectName: string;
	projectDir: string;
	sessionCount: number;
	lastSessionAt: string;
}

interface ProjectSidebarProps {
	projects: Project[];
	selectedProject: string | null;
	onSelectProject: (projectName: string | null) => void;
	loading?: boolean;
}

export function ProjectSidebar({
	projects,
	selectedProject,
	onSelectProject,
	loading,
}: ProjectSidebarProps): ReactElement {
	const totalSessions = projects.reduce((sum, p) => sum + p.sessionCount, 0);

	return (
		<aside className="project-sidebar">
			<div className="sidebar-header">
				<h3>Projects</h3>
				<span className="project-total">{projects.length}</span>
			</div>

			<div className="project-list">
				{/* All Projects option */}
				<button
					type="button"
					className={`sidebar-item ${selectedProject === null ? "active" : ""}`}
					onClick={() => onSelectProject(null)}
				>
					<span className="sidebar-item-name">All Projects</span>
					<span className="sidebar-item-count">{totalSessions}</span>
				</button>

				<div className="project-divider" />

				{/* Project list */}
				{loading ? (
					<div className="loading-projects">Loading...</div>
				) : projects.length === 0 ? (
					<div className="empty-projects">No projects yet</div>
				) : (
					projects.map((project) => (
						<button
							type="button"
							key={project.projectName}
							className={`sidebar-item ${selectedProject === project.projectName ? "active" : ""}`}
							onClick={() => onSelectProject(project.projectName)}
							title={project.projectDir}
						>
							<span className="sidebar-item-name">{project.projectName}</span>
							<span className="sidebar-item-count">{project.sessionCount}</span>
						</button>
					))
				)}
			</div>

			<style>{`
				.project-sidebar {
					width: 240px;
					flex-shrink: 0;
					background: var(--bg-secondary);
					border-right: 1px solid var(--border-subtle);
					display: flex;
					flex-direction: column;
					overflow: hidden;
				}

				.sidebar-header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: var(--space-md) var(--space-lg);
					border-bottom: 1px solid var(--border-subtle);
				}

				.sidebar-header h3 {
					font-size: 12px;
					font-weight: 600;
					text-transform: uppercase;
					letter-spacing: 0.05em;
					color: var(--text-tertiary);
					margin: 0;
				}

				.project-total {
					font-size: 11px;
					font-weight: 600;
					color: var(--text-muted);
					background: var(--bg-tertiary);
					padding: 2px 8px;
					border-radius: 10px;
				}

				.project-list {
					flex: 1;
					overflow-y: auto;
					padding: var(--space-sm);
				}

				.project-divider {
					height: 1px;
					background: var(--border-subtle);
					margin: var(--space-sm) var(--space-sm);
				}

				.sidebar-item {
					width: 100%;
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: var(--space-sm);
					padding: var(--space-sm) var(--space-md);
					border: none;
					border-radius: var(--radius-sm);
					background: transparent;
					cursor: pointer;
					transition: all var(--transition-fast);
					text-align: left;
					font-family: inherit;
				}

				.sidebar-item:hover {
					background: var(--bg-hover);
				}

				.sidebar-item.active {
					background: var(--accent-primary);
				}

				.sidebar-item-name {
					flex: 1;
					min-width: 0;
					font-size: 13px;
					font-weight: 500;
					color: var(--text-primary);
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}

				.sidebar-item.active .sidebar-item-name {
					color: white;
				}

				.sidebar-item-count {
					font-size: 11px;
					font-weight: 600;
					color: var(--text-muted);
					background: var(--bg-tertiary);
					padding: 2px 8px;
					border-radius: 10px;
					flex-shrink: 0;
				}

				.sidebar-item.active .sidebar-item-count {
					background: rgba(255, 255, 255, 0.2);
					color: white;
				}

				.loading-projects,
				.empty-projects {
					padding: var(--space-lg);
					text-align: center;
					color: var(--text-muted);
					font-size: 13px;
				}

				@media (max-width: 767px) {
					.project-sidebar {
						display: none;
					}
				}
			`}</style>
		</aside>
	);
}
