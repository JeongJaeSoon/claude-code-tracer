# Claude Code Tracer - Self-hosted Tracing Solution

> Claude Code 세션을 Flamegraph로 시각화하는 Self-hosted 트레이싱 도구

## 1. 프로젝트 개요

### 배경
- Claude Code 사용 시 JSONL 형태로 대화 로그가 저장됨
- LangSmith 같은 외부 서비스 없이 self-hosted로 트레이싱하고 싶음
- Session 단위로 Flamegraph 시각화 필요

### 목표
- Localhost 서버로 세션 데이터 수집
- Flamegraph로 도구 호출, sub-agent 실행 시간 시각화
- OSS로 공개, 나중에 사내 도입 시 인증 확장 가능

---

## 2. 아키텍처

### 전체 구조

```
┌─────────────────┐     Stop Hook      ┌──────────────────┐
│  Claude Code    │ ─────────────────▶ │  Local Collector │
│  (JSONL logs)   │                    │  (localhost:8080)│
└─────────────────┘                    └────────┬─────────┘
                                                │
                                                ▼
                                       ┌──────────────────┐
                                       │   Storage        │
                                       │ (SQLite/JSON)    │
                                       └────────┬─────────┘
                                                │
                                                ▼
                                       ┌──────────────────┐
                                       │   Web UI         │
                                       │  (Flamegraph)    │
                                       └──────────────────┘
```

### Stop Hook 설정

```bash
# ~/.claude/hooks/stop_hook.sh
#!/bin/bash
TRACE_SERVER="${TRACE_SERVER:-http://localhost:8080}"

curl -s -X POST "$TRACE_SERVER/ingest" \
  -H "Content-Type: application/json" \
  -d @"$CLAUDE_CONVERSATION_FILE"
```

```json
// ~/.claude/settings.json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "bash ~/.claude/hooks/stop_hook.sh"
      }]
    }]
  }
}
```

---

## 3. 인증 전략

### Phase 1: OSS 초기 (외부 프록시 위임)

```
[사용자] → [OAuth2-proxy/Pomerium] → [Tracer 앱]
               ↑                          ↑
           인증 처리                    인증 코드 없음
           (별도 서비스)                X-Forwarded-User 신뢰
```

- 앱에 인증 코드 없음
- 외부 프록시(nginx, OAuth2-proxy, Pomerium)가 인증 담당
- 앱은 `X-Forwarded-User` 헤더만 신뢰

```python
# 앱 코드
user = request.headers.get("X-Forwarded-User", "anonymous")
```

**장점:**
- OSS 코어가 심플
- Prometheus, Jaeger 등 모니터링 OSS와 동일 방식
- 각 회사가 기존 인프라 활용 가능

### Phase 2: 성숙기 (플러그인 아키텍처)

```python
class AuthProvider(ABC):
    @abstractmethod
    def authenticate(self, request) -> User: ...

# 기본: 헤더 기반 (Phase 1 호환)
class HeaderAuthProvider(AuthProvider):
    def authenticate(self, request):
        return User(id=request.headers.get("X-Forwarded-User", "anonymous"))

# 확장: OneLogin, Okta 등 (별도 repo 또는 enterprise)
class OneLoginAuthProvider(AuthProvider):
    def authenticate(self, request):
        # OIDC 토큰 검증 로직
        ...
```

### 사내 배포 예시

```yaml
# docker-compose.internal.yml
services:
  oauth2-proxy:
    image: quay.io/oauth2-proxy/oauth2-proxy
    environment:
      - OAUTH2_PROXY_PROVIDER=oidc
      - OAUTH2_PROXY_OIDC_ISSUER_URL=https://company.onelogin.com/oidc/2

  tracer:
    image: claude-code-tracer:latest
    environment:
      - AUTH_MODE=header
```

---

## 4. Claude Code 로그 포맷 분석

### 파일 구조

```
~/.claude/
├── projects/{project-path}/
│   ├── {session-id}.jsonl              # 메인 세션 로그
│   ├── {session-id}/
│   │   └── subagents/
│   │       └── agent-{id}.jsonl        # Task tool로 생성된 sub-agent
│   └── agent-{id}.jsonl                # 워밍업 agent
├── transcripts/
│   └── ses_{id}.jsonl                  # 간결한 트랜스크립트
├── debug/
│   └── {session-id}.txt                # 디버그 로그
└── todos/
    └── {session-id}-agent-*.json       # Todo 상태
```

### 메인 세션 JSONL 스키마

```typescript
interface SessionMessage {
  // 트리 구조 (Flamegraph 연결에 핵심)
  uuid: string;
  parentUuid: string | null;

  // 세션 정보
  sessionId: string;
  timestamp: string;               // ISO 8601
  cwd: string;
  version: string;                 // Claude Code 버전
  gitBranch: string;

  // 메시지 타입
  type: "user" | "assistant" | "summary" | "file-history-snapshot";
  isSidechain: boolean;            // sub-agent면 true
  agentId?: string;                // sub-agent ID

  // 메시지 본문
  message: {
    role: "user" | "assistant";
    model?: string;                // "claude-opus-4-5-20251101"
    id?: string;                   // "msg_01Xfg789..."
    content: ContentBlock[];
    usage?: UsageInfo;
  };

  // Tool 결과 (tool_result 타입일 때)
  toolUseResult?: {
    durationMs: number;            // Flamegraph 너비에 사용
    stdout?: string;
    stderr?: string;
    result?: string;
    bytes?: number;
    code?: number;
    url?: string;
  };
  sourceToolAssistantUUID?: string;
}

interface ContentBlock {
  type: "text" | "tool_use" | "tool_result" | "thinking";

  // tool_use
  id?: string;                     // "toolu_01TUrs..."
  name?: string;                   // "Bash", "Read", "Edit", "Task", etc.
  input?: Record<string, any>;

  // tool_result
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;

  // thinking (extended thinking)
  thinking?: string;
}

interface UsageInfo {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  cache_creation?: {
    ephemeral_5m_input_tokens: number;
    ephemeral_1h_input_tokens: number;
  };
}
```

### Sub-agent 연결 구조

```
메인 세션: {session-id}.jsonl
    │
    ├── agentId: undefined (메인)
    │
    └── Task tool 호출 시:
        └── subagents/agent-{agentId}.jsonl
            ├── agentId: "{agentId}"
            ├── sessionId: "{session-id}" (동일)
            └── isSidechain: true
```

**연결 방법:**
- `sessionId`가 동일하므로 같은 세션으로 그룹핑
- `agentId` 필드로 sub-agent 구분
- sub-agent 내부에서 또 다른 Task 호출 시 재귀적 구조

---

## 5. Flamegraph 데이터 모델

### 변환 로직

```typescript
interface FlameNode {
  name: string;
  value: number;      // duration in ms
  children: FlameNode[];
}

function toFlamegraph(messages: SessionMessage[]): FlameNode {
  const root: FlameNode = {
    name: `session_${sessionId}`,
    value: totalDuration,
    children: []
  };

  // uuid → parentUuid 로 트리 구조 복원
  const tree = buildTree(messages);

  for (const userPrompt of tree.children) {
    const promptNode: FlameNode = {
      name: truncate(userPrompt.message.content, 50),
      value: getPromptDuration(userPrompt),
      children: []
    };

    for (const toolUse of getToolCalls(userPrompt)) {
      promptNode.children.push({
        name: `${toolUse.name}: ${toolUse.input.description || ''}`,
        value: toolUse.toolUseResult?.durationMs || 0,
        children: toolUse.agentId ? loadSubagent(toolUse.agentId) : []
      });
    }

    root.children.push(promptNode);
  }

  return root;
}
```

### 예시 출력

```json
{
  "name": "session_6d186dc8",
  "value": 45000,
  "children": [
    {
      "name": "아이디어 브레인스토밍을 도와줘...",
      "value": 15000,
      "children": [
        {"name": "WebFetch: LangSmith docs", "value": 12059, "children": []},
        {"name": "LLM thinking", "value": 2941, "children": []}
      ]
    },
    {
      "name": "JSONL 로그 포맷 분석해보자",
      "value": 30000,
      "children": [
        {"name": "Bash: ls ~/.claude/", "value": 200, "children": []},
        {"name": "Bash: head session.jsonl", "value": 150, "children": []},
        {
          "name": "Task[Explore]: analyze logs",
          "value": 8000,
          "children": [
            {"name": "Grep: tool_use patterns", "value": 300, "children": []},
            {"name": "Read: agent-*.jsonl", "value": 100, "children": []}
          ]
        }
      ]
    }
  ]
}
```

---

## 6. 수집 가능한 메트릭

| 메트릭 | 소스 필드 | 용도 |
|--------|----------|------|
| 실행 시간 | `toolUseResult.durationMs` | Flamegraph 너비 |
| Input 토큰 | `usage.input_tokens` | 비용 계산 |
| Output 토큰 | `usage.output_tokens` | 비용 계산 |
| 캐시 토큰 | `usage.cache_read_input_tokens` | 캐시 효율성 |
| 도구 이름 | `content[].name` | 사용 패턴 분석 |
| 에러 여부 | `is_error` | 디버깅 |
| 모델 | `message.model` | 모델별 분석 |
| 타임스탬프 | `timestamp` | Timeline 뷰 |

---

## 7. 제한 사항

| 항목 | 상태 | 비고 |
|------|------|------|
| System Prompt | ❌ 미포함 | 보안상 JSONL에 저장 안됨 |
| 전체 API Request | ❌ 미포함 | Debug 로그에도 없음 |
| Streaming 중간 응답 | ❌ 미포함 | 최종 결과만 저장 |
| Extended Thinking | ✅ 포함 | `thinking` 블록으로 저장 |
| 도구 실행 시간 | ✅ 포함 | `durationMs` 필드 |
| Sub-agent 트레이스 | ✅ 포함 | 별도 파일로 저장, sessionId로 연결 |

---

## 8. Flamegraph 라이브러리 비교

### 후보 라이브러리

| 라이브러리 | 타입 | React 지원 | 유지보수 | 성능 | 추천도 |
|-----------|------|-----------|---------|------|--------|
| [d3-flame-graph](https://github.com/spiermar/d3-flame-graph) | D3 플러그인 | ❌ | ⚠️ 6년 전 | 보통 | ⭐⭐⭐ |
| [flame-chart-js](https://github.com/pyatyispyatil/flame-chart-js) | Canvas | ✅ | ✅ 활발 | 60fps | ⭐⭐⭐⭐⭐ |
| [react-flame-graph](https://github.com/bvaughn/react-flame-graph) | React | ✅ | ❌ 방치 | 보통 | ⭐⭐ |
| [speedscope](https://github.com/jlfwong/speedscope) | 독립 앱 | ❌ | ✅ | 우수 | ⭐⭐ (뷰어용) |

### 선정: flame-chart-js

**선정 이유:**
- React 컴포넌트 네이티브 지원 (`FlameChartComponent`)
- Canvas 기반 60fps 고성능 렌더링
- Timeline + Flamegraph 동시 지원
- 활발한 유지보수 (2025년 현재)
- 플러그인 시스템으로 확장 가능

**데이터 포맷:**
```typescript
interface FlameChartNode {
  name: string;
  start: number;      // 시작 시간 (ms)
  duration: number;   // 실행 시간 (ms)
  type?: string;      // 노드 타입 (색상 구분용)
  color?: string;     // 커스텀 색상
  children?: FlameChartNode[];
}
```

**React 사용 예시:**
```tsx
import { FlameChartComponent } from 'flame-chart-js/react';

<FlameChartComponent
  data={flameData}
  settings={{ styles: { main: { blockHeight: 18 } } }}
  onSelect={(node) => console.log('Selected:', node)}
/>
```

---

## 9. Stop Hook 인터페이스

### Hook 타입 목록

| Hook | 트리거 시점 | 용도 |
|------|------------|------|
| `SessionStart` | 세션 시작 | 초기 컨텍스트 주입 |
| `UserPromptSubmit` | 프롬프트 제출 | 입력 검증 |
| `PreToolUse` | 도구 실행 전 | 명령 차단/수정 |
| `PostToolUse` | 도구 실행 후 | 포맷터/린터 실행 |
| **`Stop`** | **응답 완료** | **트레이싱 데이터 수집** |
| `SubagentStop` | Sub-agent 완료 | Sub-agent 로깅 |
| `PreCompact` | 컨텍스트 압축 전 | 백업 |
| `SessionEnd` | 세션 종료 | 정리 작업 |

### Stop Hook stdin JSON 구조

```typescript
interface StopHookInput {
  event: "Stop";
  context: {
    projectDir: string;       // "/Users/user/project"
    conversationId: string;   // "abc123"
  };
  // 아래 필드는 확인 필요 (실제 테스트 권장)
  transcript_path?: string;   // JSONL 파일 경로
  session_id?: string;
}
```

### 환경변수

| 변수 | 설명 | 예시 |
|------|------|------|
| `CLAUDE_PROJECT_DIR` | 프로젝트 루트 | `/Users/user/project` |
| `CLAUDE_CODE_REMOTE` | 웹 환경 여부 | `"true"` 또는 미설정 |
| `CLAUDE_PLUGIN_ROOT` | 플러그인 루트 (플러그인용) | `~/.claude/plugins/...` |

### Hook 응답 형식

```typescript
// 성공 (exit 0)
{ "status": "ok" }

// 작업 계속 요청 (Claude가 계속 작업하도록)
{ "continue": true, "reason": "Tests not passed yet" }

// 차단 (exit 2)
{ "decision": "block", "reason": "Invalid operation" }
```

---

## 10. 기술 스택 (확정)

### 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                      Tech Stack                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────┐         ┌──────────────────────────┐     │
│   │  React SPA   │  fetch  │      Hono API Server     │     │
│   │  (Vite 빌드) │ ◄─────► │      (Bun 런타임)        │     │
│   │              │         │                          │     │
│   │ flame-chart  │         │  ┌──────────────────┐   │     │
│   │     -js      │         │  │   drizzle-orm    │   │     │
│   └──────────────┘         │  │                  │   │     │
│         ▲                  │  │  SQLite/Postgres │   │     │
│         │ 정적 파일        │  └──────────────────┘   │     │
│         │ 서빙             └──────────────────────────┘     │
│         │                            ▲                      │
│         │                            │ POST /ingest         │
│         │                  ┌─────────┴──────────┐           │
│         │                  │    Stop Hook       │           │
│         │                  │  (JSONL 파싱)      │           │
│         │                  └────────────────────┘           │
│         │                            ▲                      │
│         │                            │                      │
│   ┌─────┴────────────────────────────┴──────────────────┐   │
│   │                    Claude Code                       │   │
│   │              (~/.claude/projects/*.jsonl)           │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 스택 상세

| 구성요소 | 선택 | 이유 |
|---------|------|------|
| **런타임** | Bun | 빠름, TypeScript 네이티브, 단일 바이너리 |
| **백엔드** | Hono | 경량, Bun 최적화, 미들웨어 풍부 |
| **프론트엔드** | React + Vite | flame-chart-js React 지원, 빠른 HMR |
| **Flamegraph** | flame-chart-js | Canvas 60fps, React 컴포넌트 |
| **ORM** | drizzle-orm | Bun 지원, SQLite↔PostgreSQL 전환 용이 |
| **DB (Phase 1)** | SQLite | 단일 파일, 로컬 개발 최적 |
| **DB (Phase 2)** | PostgreSQL | 팀/사내 배포용 |

### Hono vs Next.js 선택 이유

```
Hono + React SPA (선택):
┌──────────────┐     API      ┌──────────────┐
│  React SPA   │ ←─────────→  │  Hono API    │
│  (정적 빌드) │   fetch()    │  (Bun 실행)  │
└──────────────┘              └──────────────┘

Next.js (미선택):
┌─────────────────────────────┐
│         Next.js             │
│  ┌─────────┐ ┌───────────┐  │
│  │  Pages  │ │ API Routes│  │
│  │  (SSR)  │ │ (서버)    │  │
│  └─────────┘ └───────────┘  │
└─────────────────────────────┘
```

**Hono + SPA 선택 이유:**
- 대시보드/시각화 앱 → SSR 불필요
- 정적 빌드 → CDN/어디서든 서빙 가능
- Hono가 더 가벼움 (번들 크기 14KB)
- Self-hosting 시 구조 단순

### DB 전환 전략 (SQLite → PostgreSQL)

drizzle-orm 사용 시 설정만 변경하면 전환 가능:

```typescript
// src/server/db/client.ts

// Phase 1: SQLite (로컬)
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';

const sqlite = new Database('tracer.db');
export const db = drizzle(sqlite);

// Phase 2: PostgreSQL (self-hosting)
// import { drizzle } from 'drizzle-orm/postgres-js';
// import postgres from 'postgres';
//
// const client = postgres(process.env.DATABASE_URL!);
// export const db = drizzle(client);
```

**스키마는 동일하게 유지:**
```typescript
// src/server/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
// PostgreSQL: import { pgTable, text, integer } from 'drizzle-orm/pg-core';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  projectDir: text('project_dir').notNull(),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  totalDurationMs: integer('total_duration_ms'),
  totalTokens: integer('total_tokens'),
});

export const toolCalls = sqliteTable('tool_calls', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => sessions.id),
  toolName: text('tool_name').notNull(),
  durationMs: integer('duration_ms'),
  timestamp: text('timestamp').notNull(),
  isError: integer('is_error', { mode: 'boolean' }),
});
```

---

## 11. 프로젝트 구조

```
claude-code-tracer/
├── package.json
├── bun.lockb
├── tsconfig.json
├── drizzle.config.ts          # DB 마이그레이션 설정
├── vite.config.ts             # 프론트엔드 빌드
│
├── src/
│   ├── server/                # 백엔드 (Hono)
│   │   ├── index.ts           # 엔트리포인트
│   │   ├── routes/
│   │   │   ├── ingest.ts      # POST /ingest (Hook 데이터 수신)
│   │   │   ├── sessions.ts    # GET /sessions, /sessions/:id
│   │   │   └── flamegraph.ts  # GET /flamegraph/:sessionId
│   │   ├── db/
│   │   │   ├── schema.ts      # drizzle 스키마
│   │   │   └── client.ts      # DB 연결
│   │   └── services/
│   │       └── parser.ts      # JSONL → FlameChart 변환
│   │
│   └── client/                # 프론트엔드 (React)
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── pages/
│       │   ├── SessionList.tsx
│       │   └── SessionDetail.tsx
│       └── components/
│           ├── FlameChart.tsx
│           ├── SessionCard.tsx
│           └── MetricsPanel.tsx
│
├── hooks/                     # Claude Code Hook
│   └── stop_hook.sh
│
├── drizzle/                   # 마이그레이션 파일
│   └── 0001_initial.sql
│
└── dist/                      # 빌드 결과물
    ├── server/                # Bun 서버
    └── client/                # 정적 파일
```

---

## 12. 추가 기능 아이디어

1. **비용 추적**: 토큰 사용량 → 예상 비용 계산 (모델별 가격 적용)
2. **도구 사용 통계**: 어떤 도구를 가장 많이 쓰는지 차트
3. **세션 비교**: 비슷한 작업의 효율성 비교
4. **Timeline 뷰**: Flamegraph 외에 간트 차트 스타일 (flame-chart-js 지원)
5. **검색/필터**: 특정 도구 호출, 에러 발생 세션 찾기
6. **Export**: OpenTelemetry 포맷으로 내보내기
7. **실시간 모니터링**: WebSocket으로 진행 중 세션 표시

---

## 13. 다음 단계

### Phase 1: MVP
1. [x] Flamegraph 라이브러리 선정 → **flame-chart-js**
2. [x] 기술 스택 확정 → **Bun + Hono + React + drizzle**
3. [ ] 프로젝트 초기 설정 (`bun create`)
4. [ ] JSONL 파서 구현 (`src/server/services/parser.ts`)
5. [ ] Stop Hook 스크립트 작성 (`hooks/stop_hook.sh`)
6. [ ] DB 스키마 및 마이그레이션
7. [ ] Ingest API 구현
8. [ ] 기본 UI (세션 목록 + Flamegraph)

### Phase 2: 개선
- [ ] 비용 계산 기능
- [ ] 검색/필터
- [ ] Docker 이미지 빌드

### Phase 3: Self-hosting
- [ ] PostgreSQL 지원
- [ ] 인증 플러그인 아키텍처
- [ ] Helm chart / docker-compose

---

## 참고 자료

### 공식 문서
- [Claude Code Hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code Hook 설정 가이드](https://claude.com/blog/how-to-configure-hooks)
- [LangSmith Claude Code Tracing](https://docs.langchain.com/langsmith/trace-claude-code)

### 라이브러리
- [flame-chart-js](https://github.com/pyatyispyatil/flame-chart-js) - 선정된 Flamegraph 라이브러리
- [d3-flame-graph](https://github.com/spiermar/d3-flame-graph) - 대안 (D3 기반)
- [speedscope](https://github.com/jlfwong/speedscope) - 독립 프로파일 뷰어
- [Hono](https://hono.dev/) - 웹 프레임워크
- [drizzle-orm](https://orm.drizzle.team/) - TypeScript ORM

### 인증 (Phase 3)
- [OAuth2-proxy](https://oauth2-proxy.github.io/oauth2-proxy/)
- [Pomerium](https://pomerium.com/)
