/**
 * Env bindings for x402-mcp-chain-query.
 * Regenerate with `npm run types` after changing wrangler.jsonc.
 */
interface Env {
  MCP: DurableObjectNamespace;
  TRIAL_KV: KVNamespace;
  UPSTREAM_API_BASE: string;
  PAY_TO: string;
  FREE_TRIAL_N: string;
  /** CDP Facilitator JWT auth — set via wrangler secret / .dev.vars */
  CDP_API_KEY_ID?: string;
  CDP_API_KEY_SECRET?: string;
}
