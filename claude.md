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

## Development

### 개발 서버 실행

```bash
# 터미널 1: 백엔드
bun run dev

# 터미널 2: 프론트엔드
bun run dev:client
```

- Backend: http://localhost:8080
- Frontend: http://localhost:5173

### UI 테스트 (Claude in Chrome)

프론트엔드 변경 후 Claude in Chrome 을 사용하여 UI 테스트

### Agent 활용 워크플로우

- **시각적 구현**: `frontend-design` - UI/UX 검토 및 프론트엔드 구현
- **코드 정리**: `code-simplifier` - 구현 후 코드 리팩토링 및 정리
- **기능 개발**: `feature-dev` + `ralph-loop` - 기능 구현 시 활용


## References

- 상세 설계: `docs/claude-code-tracer-design.md`
- UI 목업: `docs/claude-code-tracer-ui/index.html`
