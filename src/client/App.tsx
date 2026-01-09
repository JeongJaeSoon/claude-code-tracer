import { useState, useEffect, createContext, useContext } from "react";
import { SessionList } from "./pages/SessionList.tsx";
import { SessionDetail } from "./pages/SessionDetail.tsx";
import { Sidebar } from "./components/Sidebar.tsx";

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

// Router state
type Page = "list" | "detail";

interface RouterState {
  page: Page;
  sessionId?: string;
}

export function App() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [router, setRouter] = useState<RouterState>({ page: "list" });

  // Apply theme to document
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const navigate = (page: Page, sessionId?: string) => {
    setRouter({ page, sessionId });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className="app">
        <Sidebar
          currentPage={router.page}
          onNavigate={navigate}
        />
        <main className="main">
          {router.page === "list" && (
            <SessionList onSelectSession={(id) => navigate("detail", id)} />
          )}
          {router.page === "detail" && router.sessionId && (
            <SessionDetail
              sessionId={router.sessionId}
              onBack={() => navigate("list")}
            />
          )}
        </main>
      </div>

      <style>{`
        .app {
          display: flex;
          min-height: 100vh;
          width: 100vw;
        }

        .main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
      `}</style>
    </ThemeContext.Provider>
  );
}
