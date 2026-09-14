/** Locked Base mainnet CAIP-2 network (also accepted as legacy name "base"). */
export const NETWORK = "base" as const;
export const NETWORK_CAIP2 = "eip155:8453" as const;
export const BASE_CHAIN_ID = 8453;

/**
 * PayAI facilitator (no API key) — aligned with API seller desk.
 * NEVER use https://x402.org/facilitator for mainnet / real funds.
 */
export const PAYAI_FACILITATOR_URL = "https://facilitator.payai.network";

/** Locked payTo / recipient (overridable via PAY_TO env). */
export const DEFAULT_PAY_TO =
  "0xc8aaea11c93a438e2fc7bd5cddb9a6936ed3595c" as const;

export const PRICE_USD = 0.01;

/** Documented free-trial allotment per payer (N=10). */
export const DEFAULT_FREE_TRIAL_N = 10;

/** Native ETH token sentinel on Base (upstream uses zero address). */
export const NATIVE_TOKEN =
  "0x0000000000000000000000000000000000000000" as const;

export const URGENCY_VALUES = ["slow", "standard", "fast"] as const;
export type Urgency = (typeof URGENCY_VALUES)[number];
