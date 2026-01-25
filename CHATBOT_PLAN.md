# MLB Chatbot Implementation Plan

## Overview

A conversational AI chatbot that answers baseball questions by intelligently selecting and querying MLB Stats API endpoints. Built on Anthropic's Claude models with tool use capabilities.

---

## Phase 1: Free Public MVP

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  User: "When is Shohei's birthday?"                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  SvelteKit API Route: /api/chat                                 │
│  - Rate limiting (IP-based)                                     │
│  - Input validation                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Anthropic API (Claude Haiku 3.5 or Sonnet 4)                   │
│  - System prompt with endpoint catalog                          │
│  - Tool definitions from DIRECTORY                              │
│  - Resolves "Shohei" → personId: 660271                         │
│  - Selects endpoint: /api/v1/people/{personId}                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Tool Execution Layer                                           │
│  - Fetch from statsapi.mlb.com                                  │
│  - Parse and return relevant data                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Claude formats response:                                       │
│  "Shohei Ohtani was born on July 5, 1994 in Oshu, Japan."       │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Svelte 5 + SvelteKit |
| AI | Anthropic Claude API (Haiku/Sonnet) |
| Data | MLB Stats API (existing DIRECTORY) |
| Rate Limiting | In-memory or Vercel KV |
| Hosting | Vercel |

### New Files to Create

```
src/
├── routes/
│   └── api/
│       └── chat/
│           └── +server.ts        # Chat API endpoint
├── lib/
│   └── chatbot/
│       ├── tools.ts              # Tool definitions from DIRECTORY
│       ├── system-prompt.ts      # System prompt with context
│       └── player-cache.ts       # Name → ID resolution cache
└── ui/
    └── chatbot/
        ├── chat-toggle.svelte    # Nav button to open widget
        ├── chat-widget.svelte    # Floating container (bottom-right)
        ├── chat-messages.svelte  # Scrollable message list
        └── chat-input.svelte     # Textarea + send/pause buttons
```

### Tool Definitions

Convert existing `DIRECTORY` to Anthropic tool format:

```typescript
// src/lib/chatbot/tools.ts
import { DIRECTORY } from '$ui/playground/constants'

export function generateTools() {
  const tools = []

  // Player search (must be available for name resolution)
  tools.push({
    name: 'search_player',
    description: 'Search for a player by name to get their personId. Use this first when user mentions a player name.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Player name (partial match works)' }
      },
      required: ['name']
    }
  })

  // Generate tools from DIRECTORY
  for (const [category, endpoints] of Object.entries(DIRECTORY)) {
    for (const [path, config] of Object.entries(endpoints)) {
      const toolName = pathToToolName(path) // e.g., 'get_player_stats'
      tools.push({
        name: toolName,
        description: config.description,
        input_schema: generateSchema(config)
      })
    }
  }

  return tools
}
```

### System Prompt Strategy

```typescript
// src/lib/chatbot/system-prompt.ts
export const SYSTEM_PROMPT = `You are an MLB Stats assistant. Answer baseball questions using the available tools.

IMPORTANT RULES:
1. Always use search_player first when a user mentions a player by name
2. Use the current season (${currentYear}) unless the user specifies otherwise
3. For complex stats questions, you may need multiple tool calls
4. Format numbers nicely (e.g., ".324" not "0.324" for batting average)
5. Be concise but friendly

AVAILABLE DATA:
- Player bio (birthday, height, position, debut)
- Player stats (season, career, by game type)
- Team info (roster, standings, history)
- Game data (schedule, boxscore, play-by-play)
- League leaders and transactions
`
```

### Rate Limiting (Free Tier Protection)

```typescript
// Simple in-memory rate limiter
const rateLimits = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(ip: string): boolean {
  const limit = 20 // queries per window
  const windowMs = 60 * 60 * 1000 // 1 hour

  const record = rateLimits.get(ip)
  const now = Date.now()

  if (!record || now > record.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (record.count >= limit) return false
  record.count++
  return true
}
```

### Cost Estimation (Phase 1)

Assuming ~3,500 input tokens + ~600 output tokens per query:

| Daily Queries | Model | Monthly Cost |
|---------------|-------|--------------|
| 100 | Haiku 3.5 | ~$15 |
| 100 | Sonnet 4 | ~$50 |
| 500 | Haiku 3.5 | ~$75 |
| 500 | Sonnet 4 | ~$250 |

**Recommendation**: Start with Haiku 3.5, upgrade specific query types to Sonnet if needed.

### UI Components

Floating chat widget (bottom-right) triggered from nav button.

#### Structure

```
src/ui/chatbot/
├── chat-toggle.svelte    # Nav button to open/close widget
├── chat-widget.svelte    # Floating container (position, minimize)
├── chat-messages.svelte  # Scrollable message list
└── chat-input.svelte     # Textarea + send/pause buttons
```

#### States

```typescript
type ChatState = {
  open: boolean       // widget visible
  minimized: boolean  // collapsed to just header bar
  loading: boolean    // waiting for response
  paused: boolean     // user paused streaming response
}
```

#### Widget Positioning

```css
.chat-widget {
  position: fixed;
  bottom: 1ch;
  right: 1ch;
  width: min(400px, calc(100vw - 2ch));
  max-height: min(600px, calc(100vh - 2ch));
  /* 1ch margin preserved on mobile */
}

.chat-widget.minimized {
  max-height: auto; /* just header */
}
```

#### Basic Scaffolding

```svelte
<!-- src/ui/chatbot/chat-widget.svelte -->
<script lang="ts">
  import ChatMessages from './chat-messages.svelte'
  import ChatInput from './chat-input.svelte'

  type Message = { role: 'user' | 'assistant'; content: string }

  let open = $state(false)
  let minimized = $state(false)
  let loading = $state(false)
  let paused = $state(false)
  let messages = $state<Message[]>([])
  let abortController: AbortController | null = null

  export function toggle() {
    open = !open
  }

  function toggleMinimize() {
    minimized = !minimized
  }

  function pause() {
    paused = true
    abortController?.abort()
  }

  async function send(input: string) {
    if (!input.trim() || loading) return

    messages.push({ role: 'user', content: input })
    loading = true
    paused = false
    abortController = new AbortController()

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ messages }),
        signal: abortController.signal,
      })
      const data = await response.json()
      messages.push({ role: 'assistant', content: data.content })
    } catch (e) {
      if (e.name !== 'AbortError') {
        messages.push({ role: 'assistant', content: 'Something went wrong.' })
      }
    } finally {
      loading = false
    }
  }
</script>

{#if open}
  <div class="chat-widget" class:minimized>
    <header>
      <span>MLB Assistant</span>
      <button onclick={toggleMinimize}>{minimized ? '▢' : '—'}</button>
      <button onclick={toggle}>✕</button>
    </header>

    {#if !minimized}
      <ChatMessages {messages} {loading} />
      <ChatInput onsend={send} {loading} {paused} onpause={pause} />
    {/if}
  </div>
{/if}
```

```svelte
<!-- src/ui/chatbot/chat-input.svelte -->
<script lang="ts">
  let { onsend, loading, paused, onpause } = $props()
  let input = $state('')

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    if (input.trim()) {
      onsend(input)
      input = ''
    }
  }
</script>

<div class="chat-input">
  <textarea
    bind:value={input}
    onkeydown={handleKeydown}
    placeholder="Ask about MLB stats..."
    disabled={loading}
  ></textarea>

  {#if loading && !paused}
    <button onclick={onpause}>⏸</button>
  {:else}
    <button onclick={submit} disabled={loading || !input.trim()}>→</button>
  {/if}
</div>
```

---

## Phase 2: Paywall + User Data

### Additional Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Authentication Layer                                           │
│  - OAuth (Google/GitHub) or email magic links                   │
│  - Session management                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Database (Vercel Postgres or Turso/SQLite)                     │
│  - users: id, email, plan, created_at                           │
│  - conversations: id, user_id, created_at                       │
│  - messages: id, conversation_id, role, content, tokens_used    │
│  - usage: user_id, date, query_count, tokens_in, tokens_out     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Payment Integration (Stripe)                                   │
│  - Subscription tiers                                           │
│  - Usage-based billing option                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  plan TEXT DEFAULT 'free', -- 'free', 'pro', 'unlimited'
  stripe_customer_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- conversations (for chat history)
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  title TEXT, -- auto-generated from first message
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  role TEXT NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  tool_calls JSONB, -- store tool usage for debugging
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- usage tracking
CREATE TABLE usage (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  date DATE NOT NULL,
  query_count INTEGER DEFAULT 0,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);
```

### Pricing Tiers (Suggested)

| Tier | Price | Queries/Month | Features |
|------|-------|---------------|----------|
| Free | $0 | 50 | Basic questions, no history |
| Pro | $5/mo | 500 | Chat history, advanced queries |
| Unlimited | $15/mo | Unlimited | Priority, Sonnet model, export |

### New Files (Phase 2)

```
src/
├── routes/
│   ├── auth/
│   │   ├── login/+page.svelte
│   │   └── callback/+server.ts
│   ├── account/
│   │   └── +page.svelte           # Usage dashboard
│   └── api/
│       ├── chat/+server.ts        # Updated with auth
│       └── stripe/
│           └── webhook/+server.ts
├── lib/
│   ├── db/
│   │   ├── client.ts              # Database connection
│   │   ├── users.ts               # User CRUD
│   │   └── conversations.ts       # Chat history CRUD
│   └── auth/
│       └── session.ts             # Session management
```

### Auth Flow

```typescript
// src/hooks.server.ts
export async function handle({ event, resolve }) {
  const session = await getSession(event.cookies)

  if (session) {
    event.locals.user = await getUser(session.userId)
  }

  // Protect premium routes
  if (event.url.pathname.startsWith('/api/chat')) {
    if (!event.locals.user && await isRateLimited(event)) {
      return new Response('Rate limited', { status: 429 })
    }
  }

  return resolve(event)
}
```

---

## Implementation Roadmap

### Phase 1 (MVP) - Estimated Tasks

- [ ] Create `/api/chat` endpoint with Anthropic integration
- [ ] Convert DIRECTORY to tool definitions
- [ ] Build player name → ID resolution with caching
- [ ] Implement basic rate limiting
- [ ] Create chat UI components
- [ ] Add loading states and error handling
- [ ] Deploy and test with real queries

### Phase 2 (Monetization) - Estimated Tasks

- [ ] Set up database (Vercel Postgres or Turso)
- [ ] Implement authentication (OAuth or magic links)
- [ ] Add Stripe integration for subscriptions
- [ ] Build usage tracking and dashboard
- [ ] Implement chat history persistence
- [ ] Add tier-based feature gating
- [ ] Create account management UI

---

## API Gaps & Future Enhancements

### Not Available in MLB Stats API

| Feature | Alternative |
|---------|-------------|
| Batter vs Pitcher splits | Baseball Savant Statcast Search |
| Spray charts | Baseball Savant |
| Pitch movement data | Baseball Savant |
| Expected stats (xBA, xSLG) | Baseball Savant |

### Potential Baseball Savant Integration

```typescript
// Future: Add Statcast search for advanced queries
{
  name: 'statcast_matchup',
  description: 'Get batter vs pitcher head-to-head stats from Statcast',
  input_schema: {
    type: 'object',
    properties: {
      batter_id: { type: 'number' },
      pitcher_id: { type: 'number' },
      season: { type: 'number' }
    }
  }
}
```

### Other Enhancements

- **Prompt caching**: Cache system prompt to reduce costs by ~90%
- **Conversation memory**: Remember user's favorite team within session
- **Scheduled data sync**: Pre-cache daily schedule, standings
- **Natural language dates**: "yesterday", "last week", "opening day"

---

## Analytics with PostHog

Track chatbot usage and query patterns with PostHog event capture.

### Events to Track

| Event | Properties | Purpose |
|-------|------------|---------|
| `chat_query` | `query_length`, `model`, `has_tool_calls` | Usage volume |
| `chat_response` | `tokens_in`, `tokens_out`, `latency_ms`, `tools_used[]` | Cost tracking |
| `chat_error` | `error_type`, `query_preview` | Debugging |
| `rate_limit_hit` | `ip_hash`, `queries_attempted` | Abuse detection |

### Implementation

```typescript
// src/lib/analytics.ts
import posthog from 'posthog-js'

export function trackChatQuery(data: {
  queryLength: number
  model: 'haiku' | 'sonnet'
  userId?: string
}) {
  posthog.capture('chat_query', {
    query_length: data.queryLength,
    model: data.model,
    user_id: data.userId ?? 'anonymous',
  })
}

export function trackChatResponse(data: {
  tokensIn: number
  tokensOut: number
  latencyMs: number
  toolsUsed: string[]
  success: boolean
}) {
  posthog.capture('chat_response', {
    tokens_in: data.tokensIn,
    tokens_out: data.tokensOut,
    latency_ms: data.latencyMs,
    tools_used: data.toolsUsed,
    success: data.success,
    estimated_cost: estimateCost(data.tokensIn, data.tokensOut),
  })
}

function estimateCost(tokensIn: number, tokensOut: number): number {
  // Haiku pricing: $0.80/MTok in, $4/MTok out
  return (tokensIn * 0.0000008) + (tokensOut * 0.000004)
}
```

### Server-Side Tracking (for API routes)

```typescript
// src/routes/api/chat/+server.ts
import { PostHog } from 'posthog-node'

const posthog = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: 'https://app.posthog.com',
})

// In your chat handler:
const start = Date.now()
const response = await anthropic.messages.create({ ... })

posthog.capture({
  distinctId: userId ?? ipHash,
  event: 'chat_response',
  properties: {
    tokens_in: response.usage.input_tokens,
    tokens_out: response.usage.output_tokens,
    latency_ms: Date.now() - start,
    tools_used: response.content
      .filter(c => c.type === 'tool_use')
      .map(c => c.name),
  },
})
```

### Useful PostHog Dashboards

- **Daily active chatters** (unique users/IPs)
- **Queries per day** with cost overlay
- **Most used tools** (which endpoints are popular)
- **Average latency** over time
- **Error rate** by type

---

## Environment Variables Required

```env
# Phase 1
ANTHROPIC_API_KEY=sk-ant-...
POSTHOG_API_KEY=phc_...

# Phase 2
DATABASE_URL=postgres://...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
AUTH_SECRET=...
GOOGLE_CLIENT_ID=...      # if using Google OAuth
GOOGLE_CLIENT_SECRET=...
```

---

## Questions to Resolve

1. **Model choice**: Start with Haiku for all queries, or route complex ones to Sonnet?
2. **Conversation length**: How many messages to keep in context? (cost implications)
3. **Caching strategy**: Cache MLB API responses for how long? (live game data vs static bio)
4. **Free tier limits**: 20/hour vs 50/day vs 100/month?
5. **Baseball Savant**: Worth the complexity for batter-vs-pitcher queries in Phase 1?
