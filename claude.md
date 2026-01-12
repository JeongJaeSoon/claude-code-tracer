# Claude Code Tracer

Claude Code 세션을 TraceTree로 시각화하는 Self-hosted 트레이싱 도구

## Rules

- **패키지 매니저**: `bun`만 사용. npm, npx, yarn 사용 금지

## Tech Stack

- **Runtime**: Bun
- **Backend**: Hono
- **Frontend**: React + Vite
- **Visualization**: TraceTree (Lane → Turn → Step 구조)
- **ORM**: drizzle-orm
- **DB**: SQLite
- **Formatter**: Biome

## Project Structure

```
src/
├── server/          # Hono API (routes/, db/, services/, utils/)
└── client/          # React SPA (pages/, components/, contexts/, utils/)
```

## Commands

```bash
bun install          # 의존성 설치
bun run dev:server   # 백엔드 개발 서버 (Hono)
bun run dev:client   # 프론트엔드 개발 서버 (Vite)
bun run build        # 프로덕션 빌드
bun run format       # 코드 포맷팅 (Biome)
bun run lint         # 린트 검사 (Biome)
bun run check        # 포맷팅 + 린트 (Biome)
bun run db:generate  # DB 스키마 생성
bun run db:migrate   # DB 마이그레이션
bun run db:studio    # Drizzle Studio (DB 브라우저)
bun run analyze:all  # 코드 분석 (중복, 미사용, 순환 의존성)
```

## Core Concepts

1. **데이터 흐름**: Claude Code JSONL -> Stop Hook -> POST /ingest -> DB -> TraceTree UI
2. **TraceTree 구조**: Lane(Main/Sub-agent) → Turn(사용자→어시스턴트) → Step(도구 호출)
3. **Sub-agent**: 동일 `sessionId` + 다른 `agentId`로 연결, 별도 Lane으로 표시
4. **실행 시간**: `toolUseResult.durationMs` 필드로 Duration 바 시각화

## Development

### 개발 서버 실행

```bash
# 터미널 1: 백엔드
bun run dev:server

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
- UI 목업 (아카이브): `docs/archive/mockups/`
