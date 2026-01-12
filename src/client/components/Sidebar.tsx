import { useTheme } from "../App.tsx";

interface SidebarProps {
	currentPage: "projects" | "detail";
	onNavigate: (page: "projects" | "detail") => void;
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
	const { theme, setTheme } = useTheme();

	return (
		<aside className="sidebar">
			<div className="sidebar-header">
				<div className="logo">
					<div className="logo-icon">⚡</div>
					<span className="logo-text">Claude Tracer</span>
					<span className="logo-badge">MVP</span>
				</div>
			</div>

			<nav className="sidebar-nav">
				<div className="nav-section">
					<div className="nav-section-title">Overview</div>
					<button
						className={`nav-item ${currentPage === "projects" ? "active" : ""}`}
						onClick={() => onNavigate("projects")}
					>
						<svg
							className="nav-item-icon"
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
						Projects
					</button>
					<button
						className={`nav-item ${currentPage === "detail" ? "active" : ""}`}
						disabled
					>
						<svg
							className="nav-item-icon"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						Timeline
					</button>
					<button className="nav-item" disabled>
						<svg
							className="nav-item-icon"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
							/>
						</svg>
						Analytics
					</button>
				</div>

				<div className="nav-section">
					<div className="nav-section-title">Settings</div>
					<button className="nav-item">
						<svg
							className="nav-item-icon"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
							/>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
						Configuration
					</button>
				</div>
			</nav>

			<div className="sidebar-footer">
				<div className="theme-toggle">
					<button
						className={`theme-btn ${theme === "dark" ? "active" : ""}`}
						onClick={() => setTheme("dark")}
					>
						<svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
							<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
						</svg>
						Dark
					</button>
					<button
						className={`theme-btn ${theme === "light" ? "active" : ""}`}
						onClick={() => setTheme("light")}
					>
						<svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
							<path
								fillRule="evenodd"
								d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
								clipRule="evenodd"
							/>
						</svg>
						Light
					</button>
				</div>
			</div>
		</aside>
	);
}
