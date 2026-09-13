import {
  BASE_CHAIN_ID,
  NATIVE_TOKEN,
  type Urgency,
} from "./constants.js";

export type UpstreamFetchOpts = {
  baseUrl: string;
  /** Payer / wallet for free-trial passthrough to upstream. */
  payer?: string | null;
};

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function trialHeaders(payer?: string | null): HeadersInit {
  const h: Record<string, string> = { Accept: "application/json" };
  if (payer) {
    h["x-wallet-address"] = payer;
  }
  return h;
}

export type HealthResult = {
  ok: boolean;
  [key: string]: unknown;
};

export async function upstreamHealth(
  opts: UpstreamFetchOpts,
): Promise<HealthResult> {
  const res = await fetch(joinUrl(opts.baseUrl, "/health"), {
    method: "GET",
    headers: trialHeaders(opts.payer),
  });
  if (!res.ok) {
    throw new Error(`Upstream /health failed: HTTP ${res.status}`);
  }
  return (await res.json()) as HealthResult;
}

export type BalanceResult = {
  address: string;
  chainId: number;
  token: string;
  symbol: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  asOf?: string;
  [key: string]: unknown;
};

export async function upstreamBalance(
  opts: UpstreamFetchOpts & { address: string },
): Promise<BalanceResult> {
  const url = new URL(joinUrl(opts.baseUrl, "/balance"));
  url.searchParams.set("address", opts.address);
  if (opts.payer) url.searchParams.set("payer", opts.payer);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: trialHeaders(opts.payer),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Upstream /balance failed: HTTP ${res.status}${body ? ` — ${body}` : ""}`,
    );
  }
  return (await res.json()) as BalanceResult;
}

/**
 * MVP gate: only Base mainnet native ETH.
 */
export function assertBalanceMvp(data: BalanceResult): void {
  if (data.chainId !== BASE_CHAIN_ID) {
    throw new Error(
      `Rejected: chainId ${data.chainId} !== ${BASE_CHAIN_ID} (Base mainnet MVP)`,
    );
  }
  const token = String(data.token ?? "").toLowerCase();
  const native = NATIVE_TOKEN.toLowerCase();
  const isNative =
    token === native ||
    token === "native" ||
    token === "eth" ||
    token === "";
  if (!isNative) {
    throw new Error(
      `Rejected: token ${data.token} !== native (MVP supports native ETH only)`,
    );
  }
}

export function mapBalanceOutput(data: BalanceResult) {
  assertBalanceMvp(data);
  return {
    address: data.address,
    chainId: data.chainId,
    token: data.token,
    symbol: data.symbol,
    decimals: data.decimals,
    balance: data.balance,
    balanceFormatted: data.balanceFormatted,
    ...(data.asOf !== undefined ? { asOf: data.asOf } : {}),
  };
}

export type GasResult = {
  baseFeePerGas?: string | null;
  maxPriorityFeePerGas?: string | null;
  maxFeePerGas?: string | null;
  gasPrice?: string;
  urgency?: string;
  asOf?: string;
  [key: string]: unknown;
};

/**
 * Pass urgency through as-is (slow|standard|fast). No low/medium/high mapping.
 */
export async function upstreamGas(
  opts: UpstreamFetchOpts & { urgency?: Urgency },
): Promise<GasResult> {
  const url = new URL(joinUrl(opts.baseUrl, "/gas"));
  if (opts.urgency) url.searchParams.set("urgency", opts.urgency);
  if (opts.payer) url.searchParams.set("payer", opts.payer);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: trialHeaders(opts.payer),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Upstream /gas failed: HTTP ${res.status}${body ? ` — ${body}` : ""}`,
    );
  }
  return (await res.json()) as GasResult;
}

export function mapGasOutput(data: GasResult, urgency: Urgency) {
  return {
    baseFeePerGas: data.baseFeePerGas ?? null,
    maxPriorityFeePerGas: data.maxPriorityFeePerGas ?? null,
    maxFeePerGas: data.maxFeePerGas ?? null,
    gasPrice: data.gasPrice ?? null,
    // MCP enum urgency (passthrough preference: request urgency, else upstream)
    urgency: (data.urgency as Urgency | undefined) ?? urgency,
    ...(data.asOf !== undefined ? { asOf: data.asOf } : {}),
  };
}
