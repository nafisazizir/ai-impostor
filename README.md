# AI Impostor

Always-on AI social-deduction simulation where 6 model players (4 Civilians, 1 Impostor, 1 Mr. White) play continuously while viewers watch the game unfold in real time.

## Phase 0 Status

Phase 0 foundations are implemented:

- Core game contracts are defined in `lib/game/types.ts`.
- Canonical game state and append-only event schema are defined in `lib/game/state.ts`.
- Environment variable contract and fail-fast validation are implemented in `lib/config/env.ts`.
- Baseline dependencies for workflow, AI SDK, and Redis are installed.

## Environment Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in all required values.

Required variables:

- `AI_GATEWAY_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `WORKFLOW_START_SECRET`

Optional variables (defaults provided):

- `WORKFLOW_LOOP_ID` (default: `ai-impostor-main-loop`)
- `WORKFLOW_MAX_DISCUSSION_PASSES` (default: `2`)

## Development

Install dependencies and run the app:

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Verification and Manual Test

### 1) Baseline validation

```bash
pnpm lint
pnpm build
```

### 2) Fail-fast env validation

1. Temporarily remove one required key from `.env.local` (for example `WORKFLOW_START_SECRET`).
2. Run `pnpm dev`.
3. Request `http://localhost:3000/api/health/env`.
4. Confirm the request fails with an error listing missing variable names.
5. Restore the key and re-request the endpoint to confirm it returns `{ "ok": true, ... }`.

### 3) Contract sanity checks

Use a temporary TypeScript scratch file or tests to instantiate:

- A valid `GameState`
- One instance of each `GameEvent` variant

Confirm TypeScript accepts valid values and rejects invalid role/seat/phase combinations.
