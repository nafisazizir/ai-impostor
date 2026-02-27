# AI Impostor

Always-on AI social-deduction simulation where 6 model players (4 Civilians, 1 Impostor, 1 Mr. White) play continuously while viewers watch the game unfold in real time.

## Current Status

Implemented:

- Core game contracts are defined in `lib/game/types.ts`.
- Canonical game state and append-only event schema are defined in `lib/game/state.ts`.
- Environment variable contract and fail-fast validation are implemented in `lib/config/env.ts`.
- Deterministic game engine transitions and win-condition branches are implemented and tested in `lib/game/engine.test.ts`.
- Phase 2 demo workflow is implemented with hardcoded decisions in:
  - `workflows/demo-game.ts`
  - `workflows/demo-game-steps.ts`
  - `app/api/workflows/demo/start/route.ts`
  - `app/api/workflows/demo/run/route.ts`

Deferred for later phases:

- Redis checkpoint persistence
- AI model integrations (host + per-seat model calls)

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
pnpm test
pnpm lint
pnpm build
```

`pnpm test` runs deterministic game-engine unit tests in `lib/game/engine.test.ts`.

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

### 4) Demo workflow run (end-to-end)

1. Start the app with `pnpm dev`.
2. Trigger the demo workflow:

```bash
curl -X POST http://localhost:3000/api/workflows/demo/start \
  -H "Content-Type: application/json" \
  -H "x-workflow-start-secret: $WORKFLOW_START_SECRET" \
  --data '{}'
```

3. Copy the returned `runId`, then poll status:

```bash
curl "http://localhost:3000/api/workflows/demo/run?runId=<RUN_ID>"
```

Expected behavior:

- Initial responses may show `{ "ok": true, "status": "running", ... }`.
- Terminal response shows `{ "ok": true, "status": "completed", "result": { ... } }`.
- `result.finalState.currentPhase` is `"finished"` and `result.outcome` is non-null.
