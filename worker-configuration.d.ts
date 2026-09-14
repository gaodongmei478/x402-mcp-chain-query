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
  /** PayAI facilitator by default; override if needed — never x402.org for real money */
  FACILITATOR_URL?: string;
}
