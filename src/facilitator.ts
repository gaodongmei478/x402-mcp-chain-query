import type { FacilitatorConfig } from "agents/x402";
import { PAYAI_FACILITATOR_URL } from "./constants.js";

/**
 * Build FacilitatorConfig for agents/x402 `withX402`.
 * Default: PayAI hosted facilitator (no API key), Base-capable.
 * Override via FACILITATOR_URL env if needed — never x402.org for real money.
 */
export function buildFacilitatorConfig(opts?: {
  baseUrl?: string;
}): FacilitatorConfig {
  const url = (opts?.baseUrl ?? PAYAI_FACILITATOR_URL).replace(/\/$/, "");
  if (/x402\.org\/facilitator/i.test(url)) {
    throw new Error(
      "Refusing x402.org facilitator for this server — use PayAI or another mainnet facilitator",
    );
  }
  return { url };
}

/** @deprecated Use buildFacilitatorConfig — CDP hard-dep removed. */
export const buildCdpFacilitatorConfig = buildFacilitatorConfig;
