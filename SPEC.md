# AI Impostor

> LLMs play Impostor (Spyfall / Mr. White variant). Watch frontier AI models bluff, accuse, and vote each other out — live, forever.

## Game Rules

**6 players, fixed role split:**

| Role      | Count | What they know               |
| --------- | ----- | ---------------------------- |
| Civilian  | 4     | The secret word              |
| Impostor  | 1     | A related but different word |
| Mr. White | 1     | Nothing                      |

**Win conditions:**

- Civilians eliminate both the Impostor and Mr. White
- Impostor survives to 2 remaining players
- Mr. White is voted out and correctly guesses the civilians' word

A dedicated **host model** (not a player) generates the word pair before each game — one civilian word, one close-but-different impostor word.

## Player Order

Randomised once at game start and fixed for the entire game. The same seat order applies across clues, discussion, and votes. Eliminated players are simply skipped. Mr. White can land anywhere including seat 1.

## Models (6 Players)

One distinct model per seat, sourced from different providers. All accessed via **AI Gateway** for a single API key and automatic failover.

## Game Flow

Each game plays through rounds until a win condition is met.

**Clue phase** — each player in seat order thinks, then says one word or phrase publicly.

**Discussion phase** — players discuss in seat order, multiple passes. No explicit instructions given — let the models naturally develop accusations, defences, and bluffs. Each model sees all messages posted before their turn.

**Vote phase** — each player votes to eliminate someone. Plurality wins. Tie = no elimination, next round.

**Elimination** — role revealed publicly. If Mr. White is eliminated, they get one final guess at the civilian word. Correct = Mr. White wins. Wrong = eliminated, game continues.

## Runs Forever

The workflow is an infinite loop — one game finishes, the next starts automatically. It is triggered once on deploy and never needs manual intervention again. If the server crashes mid-game, execution resumes from the exact step it left off.

Each individual model call (clue, discussion message, vote) is an isolated step that retries automatically if a model stalls or a provider goes down.

Thinking tokens stream live to the frontend as each step executes.

## Tech Stack

|                      |                                                                                   |
| -------------------- | --------------------------------------------------------------------------------- |
| Framework            | Next.js 16 (App Router)                                                           |
| Workflow engine      | Vercel Workflow DevKit (WDK) — durable `"use workflow"` + `"use step"` directives |
| AI abstraction       | Vercel AI SDK                                                                     |
| Model access         | AI Gateway                                                                        |
| Game history storage | Upstash Redis                                                                     |
| Realtime             | WDK native streaming                                                              |
| Deployment           | Vercel                                                                            |
| Built with           | Claude Code                                                                       |
| UI Components        | shadcn/ui                                                                         |
