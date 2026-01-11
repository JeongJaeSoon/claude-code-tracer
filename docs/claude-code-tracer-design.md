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

## 8. 시각화 컴포넌트 선택

### 초기 계획: Flamegraph (flame-chart-js)

| 라이브러리 | 타입 | React 지원 | 유지보수 | 성능 | 추천도 |
|-----------|------|-----------|---------|------|--------|
| [d3-flame-graph](https://github.com/spiermar/d3-flame-graph) | D3 플러그인 | ❌ | ⚠️ 6년 전 | 보통 | ⭐⭐⭐ |
| [flame-chart-js](https://github.com/pyatyispyatil/flame-chart-js) | Canvas | ✅ | ✅ 활발 | 60fps | ⭐⭐⭐⭐⭐ |
| [react-flame-graph](https://github.com/bvaughn/react-flame-graph) | React | ✅ | ❌ 방치 | 보통 | ⭐⭐ |
| [speedscope](https://github.com/jlfwong/speedscope) | 독립 앱 | ❌ | ✅ | 우수 | ⭐⭐ (뷰어용) |

### 최종 선택: TraceTree (커스텀 컴포넌트)

**초기 계획:** flame-chart-js 사용
**최종 결정:** 커스텀 TraceTree 컴포넌트

**변경 이유:**
- Flamegraph는 CPU 프로파일링에 최적화된 형태로, 호출 스택 깊이 시각화에 적합
- Claude Code의 Turn 기반 대화 흐름에는 TraceTree가 더 적합
- Lane 구조로 Main과 Sub-agent를 명확히 분리 표시 가능
- Step 단위로 도구 호출을 시각화 (duration 바 포함)

**TraceTree 구조:**
```
Lane (Main 에이전트)
├── Turn 1 (사용자 프롬프트 → 어시스턴트 응답)
│   ├── Step: Bash (120ms)
│   ├── Step: Read (45ms)
│   └── Step: Edit (230ms)
└── Turn 2
    └── ...

Lane (Sub-agent: agent-abc)
├── Turn 1
│   ├── Step: Grep (80ms)
│   └── Step: Read (30ms)
└── ...
```

**장점:**
- Turn 단위로 대화 흐름 파악 용이
- Sub-agent가 별도 Lane으로 명확히 구분됨
- Duration 바로 실행 시간 직관적 확인
- 펼침/접음으로 복잡한 세션도 쉽게 탐색

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

### Stop Hook stdin JSON 구조 (실제 테스트 확인 완료)

Claude Code가 Stop Hook을 실행할 때 **stdin**으로 다음 JSON을 전달합니다:

```json
{
  "session_id": "edab9065-547f-4a63-953d-cfe76bcf3e0b",
  "transcript_path": "/Users/dev-soon/.claude/projects/-Users-dev-soon-workspace-project-claude-code-tracer/edab9065-547f-4a63-953d-cfe76bcf3e0b.jsonl",
  "cwd": "/Users/dev-soon/workspace/project/claude-code-tracer",
  "permission_mode": "default",
  "hook_event_name": "Stop",
  "stop_hook_active": false
}
```

#### 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `session_id` | `string` | 세션의 고유 UUID (예: `edab9065-547f-4a63-953d-cfe76bcf3e0b`) |
| `transcript_path` | `string` | JSONL 트랜스크립트 파일의 절대 경로. **가장 중요한 필드** - 전체 대화 기록 포함 |
| `cwd` | `string` | 현재 작업 디렉토리 (프로젝트 루트) |
| `permission_mode` | `string` | 권한 모드 (`default`, `plan`, `acceptEdits`, `dontAsk`, `bypassPermissions`) |
| `hook_event_name` | `string` | 이벤트 종류 (`Stop` 또는 `SubagentStop`) |
| `stop_hook_active` | `boolean` | Hook이 이미 활성화 중인지 여부 (무한 루프 방지용) |

#### TypeScript 인터페이스

```typescript
interface StopHookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode: "default" | "plan" | "acceptEdits" | "dontAsk" | "bypassPermissions";
  hook_event_name: "Stop" | "SubagentStop";
  stop_hook_active: boolean;
}
```

#### Transcript 파일 정보

`transcript_path`가 가리키는 JSONL 파일에는 전체 세션 데이터가 포함됩니다:

- **파일 크기**: 일반적으로 50KB ~ 500KB (대화 길이에 따라 다름)
- **라인 수**: 각 라인이 하나의 JSON 객체 (user 메시지, assistant 응답, tool_use, tool_result 등)
- **핵심 데이터**: `durationMs` 필드로 도구 실행 시간 추적 가능

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
│   │   │   ├── ingest.ts      # POST /ingest, /ingest/file (Hook 데이터 수신)
│   │   │   ├── sessions.ts    # GET /sessions, /sessions/:id, /sessions/stats
│   │   │   ├── projects.ts    # GET /projects, /projects/:name/sessions
│   │   │   └── timeline.ts    # GET /timeline/:sessionId (Turn 기반 뷰)
│   │   ├── db/
│   │   │   ├── schema.ts      # drizzle 스키마 (sessions, toolCalls, messages)
│   │   │   └── client.ts      # DB 연결 및 초기화
│   │   └── services/
│   │       └── parser.ts      # JSONL → DB 모델 변환
│   │
│   └── client/                # 프론트엔드 (React)
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx            # 라우터 + 테마 Context
│       ├── pages/
│       │   ├── ProjectList.tsx    # 프로젝트별 세션 그룹핑 (메인 페이지)
│       │   ├── SessionList.tsx    # 세션 목록 (대체 뷰)
│       │   └── SessionDetail.tsx  # 세션 상세 + Timeline
│       ├── components/
│       │   ├── Sidebar.tsx            # 네비게이션 + 테마 토글
│       │   ├── TraceTree.tsx          # Turn 기반 트레이스 트리 (핵심)
│       │   ├── DetailPanel.tsx        # 선택 항목 상세 정보
│       │   ├── CompactTimeline.tsx    # 타임라인 시각화
│       │   ├── FilterBar.tsx          # 검색/필터 UI
│       │   ├── SmartContentRenderer.tsx # 콘텐츠 렌더링
│       │   └── MarkdownRenderer.tsx   # 마크다운 + 코드 하이라이팅
│       ├── types/
│       │   └── timeline.ts        # Timeline 데이터 타입
│       ├── constants/
│       │   └── tools.ts           # 도구 아이콘/색상 매핑
│       ├── utils/
│       │   └── format.ts          # 포맷팅 유틸리티
│       └── styles/
│           └── global.css         # 전역 스타일 + 테마 변수
│
├── hooks/                     # Claude Code Hook
│   └── stop_hook.sh           # Stop Hook → /api/ingest/file
│
├── docs/                      # 문서
│   ├── claude-code-tracer-design.md  # 설계 문서
│   └── archive/mockups/       # 초기 UI 목업 (아카이브)
│
├── data/                      # SQLite 데이터 (gitignore)
│   └── tracer.db
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

### Phase 1: MVP ✅ (완료)
1. [x] 시각화 방식 선정 → **TraceTree (커스텀 컴포넌트)**
2. [x] 기술 스택 확정 → **Bun + Hono + React + drizzle**
3. [x] 프로젝트 초기 설정 (`bun create`)
4. [x] JSONL 파서 구현 (`src/server/services/parser.ts`)
   - thinking, text, tool_use, tool_result 블록 처리
   - Sub-agent 파일 자동 탐색 및 병합
5. [x] Stop Hook 스크립트 작성 (`hooks/stop_hook.sh`)
6. [x] DB 스키마 (sessions, toolCalls, messages 테이블)
7. [x] Ingest API 구현 (`POST /api/ingest`, `/api/ingest/file`)
8. [x] 기본 UI
   - ProjectList: 프로젝트별 세션 그룹핑
   - SessionDetail: 세션 상세 정보
   - TraceTree: Turn 기반 트레이스 트리 (Lane + Turn + Step 구조)
   - DetailPanel: 선택 항목 상세 (Input/Output 탭)

**추가 구현 (MVP 이상):**
- [x] Timeline API (`GET /api/timeline/:sessionId`)
- [x] Projects API (`GET /api/projects`, `/api/projects/:name/sessions`)
- [x] 도구 아이콘/색상 시스템
- [x] Dark/Light 테마 지원
- [x] Sub-agent Lane 시각화

### Phase 1.5: 품질 개선 ✅ (완료 - 2026-01-11)
- [x] TraceTree 컴포넌트 구현 (초기 계획 Flamegraph → TraceTree로 변경)
- [x] 검색/필터 기능 구현 (FilterBar 컴포넌트)
- [x] 에러 핸들링 강화 (모든 라우트에 try-catch)
- [x] Ingest API 보안 (path traversal 방지)
- [ ] 입력 검증 강화 (pagination 범위, UUID 형식) - 선택적

### Phase 2: 개선
- [ ] 비용 계산 기능 (모델별 토큰 단가 적용)
- [ ] 도구 사용 통계 API (`GET /api/tools/stats`)
- [ ] Export 기능 (JSON, OpenTelemetry 포맷)
- [ ] Docker 이미지 빌드

### Phase 3: Self-hosting
- [ ] PostgreSQL 지원 (drizzle 설정 변경만으로 가능)
- [ ] 인증 플러그인 아키텍처
- [ ] Helm chart / docker-compose
- [ ] 실시간 모니터링 (WebSocket)

---

## 참고 자료

### 공식 문서
- [Claude Code Hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code Hook 설정 가이드](https://claude.com/blog/how-to-configure-hooks)
- [LangSmith Claude Code Tracing](https://docs.langchain.com/langsmith/trace-claude-code)

### 라이브러리
- [Hono](https://hono.dev/) - 웹 프레임워크
- [drizzle-orm](https://orm.drizzle.team/) - TypeScript ORM
- [react-markdown](https://github.com/remarkjs/react-markdown) - 마크다운 렌더링
- [react-syntax-highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter) - 코드 하이라이팅

### 시각화 라이브러리 (초기 검토, 미사용)
- [flame-chart-js](https://github.com/pyatyispyatil/flame-chart-js) - 초기 검토 후 TraceTree로 대체
- [d3-flame-graph](https://github.com/spiermar/d3-flame-graph) - D3 기반 대안
- [speedscope](https://github.com/jlfwong/speedscope) - 독립 프로파일 뷰어

### 인증 (Phase 3)
- [OAuth2-proxy](https://oauth2-proxy.github.io/oauth2-proxy/)
- [Pomerium](https://pomerium.com/)

---

## 14. 현재 구현 상태 (2026-01-11 기준)

### 구현 완료 항목

#### Backend API
| 엔드포인트 | 설명 | 필터 파라미터 | 상태 |
|-----------|------|--------------|------|
| `POST /api/ingest` | JSONL 텍스트 직접 수신 | - | ✅ |
| `POST /api/ingest/file` | 파일 경로로 JSONL 읽기 | Sub-agent 자동 탐색 | ✅ |
| `GET /api/sessions` | 세션 목록 | search, status, dateRange, tool, duration, tokens | ✅ |
| `GET /api/sessions/stats` | 세션 통계 집계 | - | ✅ |
| `GET /api/sessions/:id` | 세션 상세 | - | ✅ |
| `DELETE /api/sessions/:id` | 세션 삭제 | - | ✅ |
| `GET /api/projects` | 프로젝트별 세션 그룹핑 | search, dateRange | ✅ |
| `GET /api/projects/stats` | 프로젝트 통계 | - | ✅ |
| `GET /api/projects/:name/sessions` | 프로젝트별 세션 목록 | 페이지네이션 | ✅ |
| `GET /api/timeline/:sessionId` | Turn 기반 Timeline 데이터 | Lane 분리 | ✅ |
| `GET /api/health` | 서버 상태 | - | ✅ |

#### Frontend 컴포넌트
| 컴포넌트 | 설명 | 라인 수 | 상태 |
|---------|------|--------|------|
| `ProjectList` | 프로젝트별 세션 그룹핑 (메인 페이지) | ~700 | ✅ |
| `SessionDetail` | 세션 상세 + Timeline | ~480 | ✅ |
| `TraceTree` | Turn 기반 트레이스 트리 (핵심 시각화) | ~810 | ✅ |
| `DetailPanel` | 선택 항목 상세 (Run/Input/Output/Metadata 탭) | ~760 | ✅ |
| `CompactTimeline` | 타임라인 시각화 | ~850 | ✅ |
| `FilterBar` | 검색/필터 UI | ~310 | ✅ |
| `Sidebar` | 네비게이션 + 테마 토글 | ~280 | ✅ |
| `SmartContentRenderer` | 콘텐츠 렌더링 | ~250 | ✅ |
| `MarkdownRenderer` | 마크다운 + 코드 하이라이팅 | ~300 | ✅ |

#### JSONL 파서
| 기능 | 상태 |
|------|------|
| thinking 블록 추출 | ✅ |
| text 블록 추출 | ✅ |
| tool_use 블록 추적 | ✅ |
| tool_result 매칭 및 출력 저장 | ✅ |
| Sub-agent 파일 자동 탐색 | ✅ |
| 토큰 집계 (input, output, cache) | ✅ |

### 제거된 항목 (2026-01-11)

| 항목 | 파일/패키지 | 제거 이유 |
|------|------------|----------|
| Flamegraph API | `flamegraph.ts` | TraceTree로 대체, 미사용 |
| flame-chart-js | npm 의존성 | 코드에서 미사용 |

### 선택적 개선 항목

| 우선순위 | 항목 | 설명 |
|---------|------|------|
| P1 | 입력 검증 강화 | pagination 범위, UUID 형식 검증 |
| P2 | Batch insert | Ingest 성능 최적화 |
| P2 | Virtual scrolling | TraceTree 대량 Turn 시 성능 |
| P3 | ARIA 접근성 | 키보드 네비게이션 |

### 아키텍처 결정 사항

| 항목 | 초기 설계 | 최종 구현 | 변경 이유 |
|------|----------|----------|----------|
| 시각화 방식 | Flamegraph | TraceTree | Turn 기반 UX가 더 직관적 |
| 라이브러리 | flame-chart-js | 커스텀 React | 프로젝트 요구사항에 맞춤 |
| 데이터 구조 | UUID 트리 | Lane → Turn → Step | Sub-agent 분리 표시 |
| DB | SQLite | SQLite | 계획대로 |
| ORM | drizzle-orm | drizzle-orm | 계획대로 |

### 파일 구조 현황

```
src/
├── server/
│   ├── index.ts              # Hono 서버 엔트리
│   ├── routes/
│   │   ├── ingest.ts         # ~236 lines
│   │   ├── sessions.ts       # ~248 lines
│   │   ├── projects.ts       # ~182 lines
│   │   └── timeline.ts       # ~380 lines
│   ├── db/
│   │   ├── schema.ts         # ~71 lines
│   │   └── client.ts         # ~75 lines
│   └── services/
│       └── parser.ts         # ~260 lines
│
└── client/
    ├── App.tsx               # 라우터 + 테마
    ├── pages/
    │   ├── ProjectList.tsx   # ~708 lines
    │   ├── SessionList.tsx   # ~599 lines
    │   └── SessionDetail.tsx # ~474 lines
    ├── components/
    │   ├── Sidebar.tsx           # ~280 lines
    │   ├── TraceTree.tsx         # ~814 lines (핵심)
    │   ├── DetailPanel.tsx       # ~765 lines
    │   ├── CompactTimeline.tsx   # ~853 lines
    │   ├── FilterBar.tsx         # ~314 lines
    │   ├── SmartContentRenderer.tsx # ~253 lines
    │   └── MarkdownRenderer.tsx  # ~301 lines
    ├── types/
    │   └── timeline.ts       # 타입 정의
    ├── constants/
    │   └── tools.ts          # 도구 아이콘/색상
    ├── utils/
    │   └── format.ts         # 포맷팅 유틸
    └── styles/
        └── global.css        # 전역 스타일
```
