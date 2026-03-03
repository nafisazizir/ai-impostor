# AI Impostor

Always-on spectator experience where 6 AI models play a social deduction game continuously. Viewers watch in real time as models give clues, discuss, and vote to eliminate suspects.

Each game has 4 Civilians, 1 Impostor, and 1 Mr. White across 6 fixed seats — one model per seat from different providers (OpenAI, Google, Meta, Mistral, xAI).

## Setup

```bash
pnpm install
cp .env.example .env.local  # fill in required values
pnpm dev                     # http://localhost:3000
```

**Required env vars:** `AI_GATEWAY_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `WORKFLOW_START_SECRET`

## Commands

```bash
pnpm dev       # Dev server
pnpm build     # Production build
pnpm lint      # ESLint
pnpm test      # Vitest
```

## Tech Stack

Next.js 16 · React 19 · TypeScript 5 · Tailwind CSS v4 · shadcn/ui · Vercel AI SDK · Vercel Workflow DevKit · Upstash Redis
