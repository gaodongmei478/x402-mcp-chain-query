/**
 * Cloudflare Workers remote MCP server — Base chain query tools with x402.
 *
 * Pattern: McpAgent + withX402 + paidTool
 * Docs: https://developers.cloudflare.com/agents/tools/payments/x402/charge-for-mcp-tools/
 * Example: https://github.com/cloudflare/agents/tree/main/examples/x402-mcp
 *
 * Facilitator: PayAI https://facilitator.payai.network (no API key; never x402.org on mainnet).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { withX402, type X402Config } from "agents/x402";
import { z } from "zod";
import {
  DEFAULT_PAY_TO,
  NETWORK,
  PRICE_USD,
  URGENCY_VALUES,
} from "./constants.js";
import { buildFacilitatorConfig } from "./facilitator.js";
import {
  freeTrialLimit,
  normalizePayerKey,
  recordTrialUse,
  trialSnapshot,
} from "./trial.js";
import {
  mapBalanceOutput,
  mapGasOutput,
  upstreamBalance,
  upstreamGas,
  upstreamHealth,
} from "./upstream.js";

function resolvePayTo(): `0x${string}` {
  const fromEnv =
    (typeof process !== "undefined" && process.env?.PAY_TO) || undefined;
  const addr = (fromEnv ?? DEFAULT_PAY_TO).toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(addr)) {
    throw new Error(`Invalid PAY_TO address: ${addr}`);
  }
  return addr as `0x${string}`;
}

function resolveFacilitatorUrl(env?: { FACILITATOR_URL?: string }): string | undefined {
  const fromEnv =
    env?.FACILITATOR_URL?.trim() ||
    (typeof process !== "undefined" && process.env?.FACILITATOR_URL?.trim()) ||
    undefined;
  return fromEnv || undefined;
}

const X402_CONFIG: X402Config = {
  // "base" → eip155:8453 via agents/x402 normalizeNetwork
  network: NETWORK,
  recipient: resolvePayTo(),
  facilitator: buildFacilitatorConfig({ baseUrl: resolveFacilitatorUrl() }),
};

function textResult(payload: unknown, isError = false) {
  return {
    content: [
      {
        type: "text" as const,
        text:
          typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
    ...(isError ? { isError: true } : {}),
  };
}

function upstreamBase(env: Env): string {
  return (
    env.UPSTREAM_API_BASE?.trim() ||
    (typeof process !== "undefined" && process.env?.UPSTREAM_API_BASE) ||
    "http://127.0.0.1:4021"
  );
}

/**
 * Extract payer hint from tool args or MCP request headers for trial passthrough.
 */
function extractPayer(
  args: { payer?: string },
  // MCP RequestHandlerExtra.requestInfo.headers is IsomorphicHeaders
  // (values may be undefined) — keep loose for SDK compatibility.
  extra?: {
    requestInfo?: {
      headers?: Record<string, string | string[] | undefined>;
    };
  },
): string | null {
  const fromArg = normalizePayerKey(args.payer);
  if (fromArg) return fromArg;
  const headers = extra?.requestInfo?.headers ?? {};
  const raw =
    headers["x-wallet-address"] ??
    headers["X-Wallet-Address"] ??
    headers["x-payer"] ??
    undefined;
  const headerVal = Array.isArray(raw) ? raw[0] : raw;
  return normalizePayerKey(typeof headerVal === "string" ? headerVal : null);
}

export class ChainQueryMCP extends McpAgent<Env> {
  server = withX402(
    new McpServer({
      name: "x402-mcp-chain-query",
      version: "1.0.0",
    }),
    X402_CONFIG,
  );

  async init() {
    // Free tool
    this.server.tool(
      "health",
      "Health check against the upstream chain-query API (free).",
      {
        payer: z
          .string()
          .optional()
          .describe("Optional 0x payer for trial header passthrough"),
      },
      async (args, extra) => {
        try {
          const payer = extractPayer(args, extra);
          const base = upstreamBase(this.env);
          const data = await upstreamHealth({ baseUrl: base, payer });
          const trial = await trialSnapshot(
            this.env.TRIAL_KV,
            payer,
            freeTrialLimit(this.env),
          );
          return textResult({
            ...data,
            mcp: {
              network: NETWORK,
              payTo: resolvePayTo(),
              upstream: base,
              freeTrial: trial,
            },
          });
        } catch (err) {
          return textResult(
            {
              error: "health_failed",
              detail: err instanceof Error ? err.message : String(err),
            },
            true,
          );
        }
      },
    );

    // Paid — $0.01
    this.server.paidTool(
      "chain_balance",
      "Base mainnet native ETH balance for an address ($0.01 via x402).",
      PRICE_USD,
      {
        address: z
          .string()
          .describe("EVM address to query on Base mainnet (0x…)"),
        payer: z
          .string()
          .optional()
          .describe(
            "Optional payer wallet (x-wallet-address / ?payer passthrough for upstream free-trial N=10)",
          ),
      },
      {},
      async (args, extra) => {
        try {
          const payer = extractPayer(args, extra);
          await recordTrialUse(
            this.env.TRIAL_KV,
            payer,
            freeTrialLimit(this.env),
          );
          const raw = await upstreamBalance({
            baseUrl: upstreamBase(this.env),
            address: args.address,
            payer,
          });
          const mapped = mapBalanceOutput(raw);
          return textResult(mapped);
        } catch (err) {
          return textResult(
            {
              error: "chain_balance_failed",
              detail: err instanceof Error ? err.message : String(err),
            },
            true,
          );
        }
      },
    );

    // Paid — $0.01; urgency passed through as slow|standard|fast (no remapping)
    this.server.paidTool(
      "chain_gas",
      "Base mainnet gas fee hint ($0.01 via x402). Urgency: slow|standard|fast (passed through to upstream).",
      PRICE_USD,
      {
        urgency: z
          .enum(URGENCY_VALUES)
          .default("standard")
          .describe("Gas urgency hint: slow | standard | fast (passthrough)"),
        payer: z
          .string()
          .optional()
          .describe(
            "Optional payer wallet (x-wallet-address / ?payer passthrough for upstream free-trial N=10)",
          ),
      },
      {},
      async (args, extra) => {
        try {
          const urgency = args.urgency ?? "standard";
          const payer = extractPayer(args, extra);
          await recordTrialUse(
            this.env.TRIAL_KV,
            payer,
            freeTrialLimit(this.env),
          );
          const raw = await upstreamGas({
            baseUrl: upstreamBase(this.env),
            urgency,
            payer,
          });
          const mapped = mapGasOutput(raw, urgency);
          return textResult(mapped);
        } catch (err) {
          return textResult(
            {
              error: "chain_gas_failed",
              detail: err instanceof Error ? err.message : String(err),
            },
            true,
          );
        }
      },
    );
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Streamable HTTP MCP endpoint
    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      return ChainQueryMCP.serve("/mcp", { binding: "MCP" }).fetch(
        request,
        env,
        ctx,
      );
    }

    // Convenience: legacy SSE mount (optional clients)
    if (url.pathname === "/sse" || url.pathname.startsWith("/sse/")) {
      return ChainQueryMCP.serveSSE("/sse", { binding: "MCP" }).fetch(
        request,
        env,
        ctx,
      );
    }

    if (url.pathname === "/" || url.pathname === "/healthz") {
      return Response.json({
        ok: true,
        name: "x402-mcp-chain-query",
        mcp: "/mcp",
        network: NETWORK,
        payTo: env.PAY_TO || DEFAULT_PAY_TO,
        upstream: env.UPSTREAM_API_BASE || "http://127.0.0.1:4021",
        tools: {
          health: "free",
          chain_balance: `$${PRICE_USD}`,
          chain_gas: `$${PRICE_USD}`,
        },
        freeTrialN: freeTrialLimit(env),
        facilitator: env.FACILITATOR_URL || "https://facilitator.payai.network",
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
