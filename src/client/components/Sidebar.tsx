import { useTheme } from "../App.tsx";

interface SidebarProps {
  currentPage: "list" | "detail";
  onNavigate: (page: "list" | "detail") => void;
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
            className={`nav-item ${currentPage === "list" ? "active" : ""}`}
            onClick={() => onNavigate("list")}
          >
            <svg className="nav-item-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
            </svg>
            Sessions
          </button>
          <button
            className={`nav-item ${currentPage === "detail" ? "active" : ""}`}
            onClick={() => onNavigate("detail")}
          >
            <svg className="nav-item-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            Flamegraph
          </button>
          <button className="nav-item">
            <svg className="nav-item-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            Analytics
          </button>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Settings</div>
          <button className="nav-item">
            <svg className="nav-item-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
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
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
            </svg>
            Dark
          </button>
          <button
            className={`theme-btn ${theme === "light" ? "active" : ""}`}
            onClick={() => setTheme("light")}
          >
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd"/>
            </svg>
            Light
          </button>
        </div>
      </div>

      <style>{`
        .sidebar {
          width: 260px;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
        }

        .sidebar-header {
          padding: var(--space-lg);
          border-bottom: 1px solid var(--border-subtle);
        }

        .logo {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .logo-icon {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }

        .logo-text {
          font-weight: 700;
          font-size: 15px;
          letter-spacing: -0.02em;
        }

        .logo-badge {
          font-size: 10px;
          font-weight: 600;
          background: var(--accent-primary);
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: auto;
        }

        .sidebar-nav {
          flex: 1;
          padding: var(--space-md);
          overflow-y: auto;
        }

        .nav-section {
          margin-bottom: var(--space-lg);
        }

        .nav-section-title {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-tertiary);
          padding: var(--space-sm) var(--space-md);
          margin-bottom: var(--space-xs);
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: var(--space-sm) var(--space-md);
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 500;
          transition: all var(--transition-fast);
          width: 100%;
          text-align: left;
          background: transparent;
          border: none;
        }

        .nav-item:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .nav-item.active {
          background: var(--bg-active);
          color: var(--text-primary);
        }

        .nav-item-icon {
          width: 18px;
          height: 18px;
          opacity: 0.7;
        }

        .nav-item.active .nav-item-icon {
          opacity: 1;
        }

        .sidebar-footer {
          padding: var(--space-md);
          border-top: 1px solid var(--border-subtle);
        }

        .theme-toggle {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          padding: 2px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-md);
        }

        .theme-btn {
          flex: 1;
          padding: var(--space-sm) var(--space-md);
          border-radius: var(--radius-sm);
          border: none;
          background: transparent;
          color: var(--text-tertiary);
          font-size: 12px;
          font-weight: 500;
          transition: all var(--transition-fast);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-xs);
        }

        .theme-btn.active {
          background: var(--bg-elevated);
          color: var(--text-primary);
          box-shadow: var(--shadow-sm);
        }
      `}</style>
    </aside>
  );
}
