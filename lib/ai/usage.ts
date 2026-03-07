// ─── Per-call token usage ────────────────────────────────────────────────────

export type CallUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

// ─── Per-game aggregate ──────────────────────────────────────────────────────

export type GameTokenUsage = {
  total: CallUsage;
  byModel: Record<string, CallUsage>;
  callCount: number;
};

// ─── Constructors ────────────────────────────────────────────────────────────

export function emptyCallUsage(): CallUsage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

export function emptyGameTokenUsage(): GameTokenUsage {
  return { total: emptyCallUsage(), byModel: {}, callCount: 0 };
}

// ─── Accumulation ────────────────────────────────────────────────────────────

export function addCallUsage(a: CallUsage, b: CallUsage): CallUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

export function accumulateUsage(
  game: GameTokenUsage,
  modelId: string,
  call: CallUsage,
): GameTokenUsage {
  const existing = game.byModel[modelId] ?? emptyCallUsage();
  return {
    total: addCallUsage(game.total, call),
    byModel: { ...game.byModel, [modelId]: addCallUsage(existing, call) },
    callCount: game.callCount + 1,
  };
}

export function mergeGameUsage(
  a: GameTokenUsage,
  b: GameTokenUsage,
): GameTokenUsage {
  const merged: GameTokenUsage = {
    total: addCallUsage(a.total, b.total),
    byModel: { ...a.byModel },
    callCount: a.callCount + b.callCount,
  };
  for (const [model, usage] of Object.entries(b.byModel)) {
    merged.byModel[model] = addCallUsage(
      merged.byModel[model] ?? emptyCallUsage(),
      usage,
    );
  }
  return merged;
}
