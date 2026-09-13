import { generateJwt } from "@coinbase/cdp-sdk/auth";
import type { FacilitatorConfig } from "agents/x402";
import { CDP_FACILITATOR_URL } from "./constants.js";

/**
 * Build FacilitatorConfig for agents/x402 `withX402`.
 * Uses CDP mainnet facilitator URL + JWT auth when credentials are present.
 *
 * Pattern mirrors `@coinbase/cdp-sdk/x402` `createCdpFacilitatorClient`
 * (createAuthHeaders keyed by verify/settle/supported) but returns the
 * FacilitatorConfig shape that `withX402` expects.
 */
export function buildCdpFacilitatorConfig(opts: {
  apiKeyId?: string;
  apiKeySecret?: string;
  baseUrl?: string;
}): FacilitatorConfig {
  const url = opts.baseUrl ?? CDP_FACILITATOR_URL;
  const apiKeyId = opts.apiKeyId;
  const apiKeySecret = opts.apiKeySecret;

  if (!apiKeyId || !apiKeySecret) {
    // Local unpaid 402 demos still need the CDP URL (never x402.org on mainnet).
    // Without keys, verify/settle will fail until secrets are configured.
    return { url };
  }

  let host: string;
  let basePath: string;
  try {
    const parsed = new URL(url);
    host = parsed.host;
    basePath = parsed.pathname.replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid facilitator URL: ${url}`);
  }

  const paths = {
    verify: `${basePath}/verify`,
    settle: `${basePath}/settle`,
    supported: `${basePath}/supported`,
  } as const;

  const authFor = async (
    path: string,
    method: "GET" | "POST",
  ): Promise<Record<string, string>> => {
    const jwt = await generateJwt({
      apiKeyId,
      apiKeySecret,
      requestMethod: method,
      requestHost: host,
      requestPath: path,
    });
    return {
      Authorization: `Bearer ${jwt}`,
      "Correlation-Context": "sdkLanguage=typescript,source=x402-mcp-chain-query",
    };
  };

  return {
    url,
    createAuthHeaders: async () => {
      const [verify, settle, supported] = await Promise.all([
        authFor(paths.verify, "POST"),
        authFor(paths.settle, "POST"),
        authFor(paths.supported, "GET"),
      ]);
      return { verify, settle, supported };
    },
  };
}
