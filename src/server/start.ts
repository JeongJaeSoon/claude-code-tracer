/**
 * 개발 서버 진입점
 * bun run dev:server 명령으로 실행됩니다.
 * Server mode로 실행되며, DbRepository를 사용합니다.
 */

import { createApp } from "./index.ts";
import { DbRepository } from "./repositories/db-repository.ts";

const port = Number(process.env.PORT) || 8080;
const repository = new DbRepository();

const app = createApp({
	mode: "server",
	port,
	repository,
});

console.log(`🔥 Claude Code Tracer server running at http://localhost:${port}`);
console.log("Mode: server (database, read-write)");

export default {
	port,
	fetch: app.fetch,
};
