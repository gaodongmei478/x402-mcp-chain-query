# x402-mcp-chain-query

Cloudflare Workers **remote MCP** server that exposes Base mainnet chain query tools with **x402** payments, using the Agents SDK (`McpAgent` + `withX402` + `paidTool`).

Follows [Charge for MCP tools](https://developers.cloudflare.com/agents/tools/payments/x402/charge-for-mcp-tools/) and the [x402-mcp example](https://github.com/cloudflare/agents/tree/main/examples/x402-mcp), but uses the **PayAI facilitator** (`https://facilitator.payai.network`, no API key) — **never** `x402.org` for mainnet / real funds.


## Connect in Cursor (one-paste)

Live MCP (temporary Worker — renew via claim/ops as needed):

`https://x402-mcp-chain-query.marshy-shake.workers.dev/mcp`

Paste into Cursor **Customize → MCP** / project `.cursor/mcp.json` / user `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "x402-chain-query": {
      "url": "https://x402-mcp-chain-query.marshy-shake.workers.dev/mcp"
    }
  }
}
```

Docs: [Cursor MCP](https://cursor.com/docs/mcp)

### Companion HTTP seller (optional)

Same stack, raw HTTP (not MCP):

- Base: `https://x402-chain-query.marshy-shake.workers.dev`
- `GET /health` free · `GET /balance` · `GET /gas`
- **$0.01** USDC · trial **N=10** (upstream) · **PayAI** facilitator · **Base** (`eip155:8453`)
- `payTo`: `0xc8aaea11c93a438e2fc7bd5cddb9a6936ed3595c`


## Tools

| Tool | Price | Notes |
|------|-------|--------|
| `health` | free (`server.tool`) | Proxies `GET /health` on upstream |
| `chain_balance` | **$0.01** (`paidTool`) | Proxies `GET /balance?address=` — MVP rejects `chainId !== 8453` and non-native token |
| `chain_gas` | **$0.01** (`paidTool`) | Proxies `GET /gas?urgency=` — urgency enum `slow\|standard\|fast` **passed through as-is** (no low/medium/high mapping) |

**payTo / recipient:** `0xc8aaea11c93a438e2fc7bd5cddb9a6936ed3595c`  
**network:** `base` (mainnet → `eip155:8453`)  
**facilitator:** `https://facilitator.payai.network` (PayAI, no API key)

### Output fields

- **chain_balance:** `address`, `chainId`, `token`, `symbol`, `decimals`, `balance`, `balanceFormatted`, `asOf` (when present)
- **chain_gas:** `baseFeePerGas`, `maxPriorityFeePerGas`, `maxFeePerGas`, `gasPrice`, `urgency` (MCP enum), `asOf`

## Free trial (N=10)

Documented allotment: **10** free uses per payer (`FREE_TRIAL_N`).

- Best-effort **KV** counter (`TRIAL_KV`) keyed by payer address (observability / remaining).
- MCP `paidTool` still requires x402 payment before the handler runs; a true MCP-side free bypass is **TODO**.
- Upstream seller receives `x-wallet-address` header and/or `?payer=` so it can grant its own free trials.

## Upstream

Default / live temporary seller: `UPSTREAM_API_BASE=https://x402-chain-query.marshy-shake.workers.dev` (companion `x402-chain-query`; local `:4021` still OK for dev).

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | none |
| GET | `/balance?address=` | none (x402 at MCP / seller layer) |
| GET | `/gas?urgency=` | none — urgency `slow\|standard\|fast` passthrough |

No upstream API key.

## Setup

```bash
cd /workspace/x402-mcp-chain-query
cp .dev.vars.example .dev.vars
# Edit .dev.vars if needed (PayAI needs no keys; never commit secrets)
npm install
```

### Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `UPSTREAM_API_BASE` | no | `https://x402-chain-query.marshy-shake.workers.dev` | Upstream chain-query HTTP API |
| `FACILITATOR_URL` | no | `https://facilitator.payai.network` | x402 facilitator (PayAI; never x402.org for real money) |
| `PAY_TO` | no | `0xc8aaea11c93a438e2fc7bd5cddb9a6936ed3595c` | x402 payment recipient |
| `FREE_TRIAL_N` | no | `10` | Documented trial allotment / KV counter limit |

**Do not commit secrets.** PayAI facilitator needs no API key. Use `.dev.vars` locally for overrides.

## Local development

Start the upstream seller on `:4021` if you want live tool results, then:

```bash
npm run dev
# → wrangler dev (MCP at http://localhost:8787/mcp by default)
```

Typecheck:

```bash
npm run typecheck
```

Connect MCP Inspector or another client to `http://localhost:8787/mcp`.

## Mainnet / CDP warning

- This project targets **Base mainnet** and the **CDP facilitator**.
- **Never** point mainnet payments at `https://x402.org/facilitator` (test facilitator).
- Facilitator defaults to PayAI (no API key). Still **never** point mainnet at `https://x402.org/facilitator`.
- Do not deploy or settle real payments from this scaffold until keys and `PAY_TO` are intentional.

## Deploy (not done by scaffold)

```bash
npx wrangler kv namespace create TRIAL_KV   # put real id into wrangler.jsonc
# npm run deploy   # only when you intend to ship
```

## Stack

- `agents` — `McpAgent`, `agents/x402` (`withX402`, `paidTool`)
- `@modelcontextprotocol/sdk` — `McpServer`
- `zod` — tool input schemas
- `@coinbase/cdp-sdk` — CDP JWT for facilitator `createAuthHeaders`
- `@x402/core` / `@x402/evm` — peer deps of `agents/x402`
- `wrangler` — Workers / Durable Objects / KV
