import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema.ts";

const dbPath = process.env.DATABASE_URL || "./data/tracer.db";

// Ensure directory exists
const dbDir = dbPath.substring(0, dbPath.lastIndexOf("/"));
if (dbDir) {
	await Bun.write(dbDir + "/.gitkeep", "");
}

const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrent read/write performance
sqlite.run("PRAGMA journal_mode = WAL");
sqlite.run("PRAGMA foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Initialize tables
const initSQL = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project_dir TEXT NOT NULL,
  project_name TEXT NOT NULL,
  git_branch TEXT,
  model TEXT,
  version TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  total_duration_ms INTEGER,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  cache_creation_tokens INTEGER DEFAULT 0,
  tool_call_count INTEGER DEFAULT 0,
  sub_agent_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  parent_id TEXT,
  uuid TEXT NOT NULL,
  parent_uuid TEXT,
  agent_id TEXT,
  tool_name TEXT NOT NULL,
  tool_input TEXT,
  tool_output TEXT,
  duration_ms INTEGER,
  start_time REAL NOT NULL,
  is_error INTEGER DEFAULT 0,
  error_message TEXT,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  uuid TEXT NOT NULL,
  parent_uuid TEXT,
  type TEXT NOT NULL,
  agent_id TEXT,
  is_sidechain INTEGER DEFAULT 0,
  content TEXT,
  thinking TEXT,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_session ON tool_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
`;

sqlite.run(initSQL);

export { sqlite };
