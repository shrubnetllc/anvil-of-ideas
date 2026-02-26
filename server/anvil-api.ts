/**
 * Client for communicating with the anvil-api (FastAPI) service.
 * Authenticates via JWT and triggers document generation.
 */

const ANVIL_API_URL = process.env.ANVIL_API_URL;
const ANVIL_API_USERNAME = process.env.ANVIL_API_USERNAME;
const ANVIL_API_PASSWORD = process.env.ANVIL_API_PASSWORD;
const ANVIL_CALLBACK_URL = process.env.ANVIL_CALLBACK_URL;
const ANVIL_WEBHOOK_SECRET = process.env.ANVIL_WEBHOOK_SECRET;

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

function isConfigured(): boolean {
  return !!(ANVIL_API_URL && ANVIL_API_USERNAME && ANVIL_API_PASSWORD);
}

async function getToken(): Promise<string> {
  // Reuse token if it has more than 5 minutes left
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  const response = await fetch(`${ANVIL_API_URL}/login/access-token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      username: ANVIL_API_USERNAME!,
      password: ANVIL_API_PASSWORD!,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`anvil-api auth failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // Default token lifetime is 8 days; cache conservatively for 1 day
  tokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
  return cachedToken!;
}

/**
 * Trigger the full document generation pipeline (LeanCanvas → PRD → BRD → FRD)
 * for the given idea via the anvil-api.
 *
 * @param ideaId - The idea UUID to generate documents for
 * @param jobId - The job UUID created in anvil-of-ideas for tracking progress
 */
export async function triggerGeneration(
  ideaId: string,
  jobId: string,
): Promise<{ message: string; idea_id: string }> {
  if (!isConfigured()) {
    throw new Error(
      "anvil-api not configured. Set ANVIL_API_URL, ANVIL_API_USERNAME, and ANVIL_API_PASSWORD."
    );
  }

  const token = await getToken();
  const response = await fetch(`${ANVIL_API_URL}/jobs/generate/${ideaId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      job_id: jobId,
      callback_url: ANVIL_CALLBACK_URL || null,
      webhook_secret: ANVIL_WEBHOOK_SECRET || null,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`anvil-api generation failed (${response.status}): ${text}`);
  }

  return response.json();
}
