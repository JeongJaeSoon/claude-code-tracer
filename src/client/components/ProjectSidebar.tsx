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
		</aside>
	);
}
