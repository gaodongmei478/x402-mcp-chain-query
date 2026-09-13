import { DEFAULT_FREE_TRIAL_N } from "./constants.js";

/**
 * Free trial N=10 (documented product default).
 *
 * MCP `paidTool` always requires x402 payment before the handler runs, so a
 * true "free unpaid tool call" bypass is not wired here. Instead:
 * 1. Best-effort KV counter keyed by payer (observability / remaining quota).
 * 2. Upstream Express seller (`UPSTREAM_API_BASE`) still receives
 *    `x-wallet-address` / `?payer=` so it can grant its own free trials.
 *
 * TODO: optional MCP-side free bypass of paidTool once Agents SDK exposes a
 *       pre-payment hook; until then rely on upstream trial + this counter.
 */
export function freeTrialLimit(env: { FREE_TRIAL_N?: string }): number {
  const n = Number(env.FREE_TRIAL_N ?? DEFAULT_FREE_TRIAL_N);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_FREE_TRIAL_N;
}

export function normalizePayerKey(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(s)) return null;
  return s;
}

/**
 * Increment KV usage for payer; returns remaining after increment (best-effort).
 * Does not gate paidTool — see module TODO.
 */
export async function recordTrialUse(
  kv: KVNamespace | undefined,
  payer: string | null,
  limit: number,
): Promise<{ used: number; remaining: number; limited: boolean } | null> {
  if (!kv || !payer || limit <= 0) return null;
  const key = `trial:${payer}`;
  try {
    const prev = Number((await kv.get(key)) ?? "0");
    const used = (Number.isFinite(prev) ? prev : 0) + 1;
    await kv.put(key, String(used));
    const remaining = Math.max(0, limit - used);
    return { used, remaining, limited: used > limit };
  } catch {
    return null;
  }
}

export async function trialSnapshot(
  kv: KVNamespace | undefined,
  payer: string | null,
  limit: number,
): Promise<{ limit: number; used: number | null; remaining: number | null }> {
  if (!kv || !payer) {
    return { limit, used: null, remaining: null };
  }
  try {
    const used = Number((await kv.get(`trial:${payer}`)) ?? "0");
    const u = Number.isFinite(used) ? used : 0;
    return { limit, used: u, remaining: Math.max(0, limit - u) };
  } catch {
    return { limit, used: null, remaining: null };
  }
}
