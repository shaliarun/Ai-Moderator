import Anthropic from "@anthropic-ai/sdk";

const apiKey =
  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ??
  process.env.ANTHROPIC_API_KEY;

const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;

if (!apiKey) {
  throw new Error(
    "Anthropic API key not found. Set ANTHROPIC_API_KEY (local) or provision the Anthropic AI integration (Replit).",
  );
}

export const anthropic = new Anthropic({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
});
