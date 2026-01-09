# Claude Code Tracer

Claude Code 세션을 Flamegraph로 시각화하는 Self-hosted 트레이싱 도구

## Tech Stack

- **Runtime**: Bun
- **Backend**: Hono
- **Frontend**: React + Vite
- **Flamegraph**: flame-chart-js
- **ORM**: drizzle-orm
- **DB**: SQLite

## Project Structure

```
src/
├── server/          # Hono API (routes/, db/, services/)
└── client/          # React SPA (pages/, components/)
```

## Core Concepts

1. **데이터 흐름**: Claude Code JSONL -> Stop Hook -> POST /ingest -> DB -> Flamegraph UI
2. **트리 구조**: `uuid`/`parentUuid`로 호출 트리 구성
3. **Sub-agent**: 동일 `sessionId` + 다른 `agentId`로 연결
4. **실행 시간**: `toolUseResult.durationMs` 필드 활용

## Commands

```bash
bun install      # 의존성 설치
bun run dev      # 개발 서버
bun run db:push  # DB 마이그레이션
bun run build    # 빌드
```

## References

- 상세 설계: `docs/claude-code-tracer-design.md`
- UI 목업: `docs/claude-code-tracer-ui/index.html`
