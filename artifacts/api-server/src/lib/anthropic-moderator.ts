import { logger } from "./logger";

export interface TurnContext {
  product: string;
  goal: string;
  questions: string[];
  questionIndex: number;
  followUpsAsked: number;
  history: { speaker: "ai" | "participant"; text: string }[];
  participantText: string;
}

export interface TurnDecision {
  aiQuestion: string;
  action: "follow_up" | "next_question" | "wrap_up";
  isFinal: boolean;
}

export interface InsightResult {
  summary: string;
  painPoints: string[];
  userGoals: string[];
  featureRequests: string[];
  recommendations: string[];
}

const MAX_FOLLOW_UPS_PER_QUESTION = 2;
const DEFAULT_OPENAI_MODELS = [
  "gpt-5.4-mini",
  "gpt-5-mini",
  "gpt-4.1-mini",
];
const DEFAULT_ANTHROPIC_MODELS = [
  "claude-sonnet-4-20250514",
  "claude-3-5-haiku-20241022",
  "claude-3-haiku-20240307",
];
const AI_PROVIDER = (process.env.AI_PROVIDER ?? "openai").toLowerCase();
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODELS[0]!;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODELS[0]!;
const ENABLE_ANTHROPIC_FALLBACK = AI_PROVIDER === "anthropic" || process.env.ENABLE_ANTHROPIC_FALLBACK === "true";
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS ?? "12000");
type AiTextRequest = { system?: string; input: string; maxOutputTokens: number };
type AnthropicMessageParams = {
  max_tokens: number;
  system?: string;
  messages: Array<{ role: "user"; content: string }>;
};
type AnthropicTextMessage = { content: Array<{ type: string; text?: string }> };

function configuredOpenAIModels(): string[] {
  const configured = [
    OPENAI_MODEL,
    ...(process.env.OPENAI_FALLBACK_MODELS ?? "").split(","),
    ...DEFAULT_OPENAI_MODELS,
  ];

  return [...new Set(configured.map((model) => model.trim()).filter(Boolean))];
}

function configuredAnthropicModels(): string[] {
  const configured = [
    ANTHROPIC_MODEL,
    ...(process.env.ANTHROPIC_FALLBACK_MODELS ?? "").split(","),
    ...DEFAULT_ANTHROPIC_MODELS,
  ];

  return [...new Set(configured.map((model) => model.trim()).filter(Boolean))];
}

function getErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const candidate = err as { status?: unknown; statusCode?: unknown };
  return typeof candidate.status === "number"
    ? candidate.status
    : typeof candidate.statusCode === "number"
      ? candidate.statusCode
      : undefined;
}

function isRetryableProviderError(err: unknown): boolean {
  const status = getErrorStatus(err);
  return status === undefined || status === 408 || status === 409 || status === 429 || status >= 500;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timeoutError(label: string): Error & { status: number } {
  const err = new Error(`${label} timed out.`) as Error & { status: number };
  err.status = 408;
  return err;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(timeoutError(label)), ms);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function createAnthropicMessageWithFallback(
  params: Omit<AnthropicMessageParams, "model">,
  logLabel: string,
): Promise<{ message: AnthropicTextMessage; model: string }> {
  let lastError: unknown;
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY);
  if (!hasAnthropicKey) {
    throw new Error("Anthropic is not configured.");
  }

  const { anthropic } = await import("@workspace/integrations-anthropic-ai");

  for (const model of configuredAnthropicModels()) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const message = await anthropic.messages.create({ ...params, model }) as AnthropicTextMessage;
        return { message, model };
      } catch (err) {
        lastError = err;
        logger.warn({ err, model, attempt }, `${logLabel} failed`);

        if (!isRetryableProviderError(err)) break;
        await wait(350 * attempt);
      }
    }
  }

  throw lastError;
}

function openAIError(message: string, status?: number): Error {
  const err = new Error(message) as Error & { status?: number };
  err.status = status;
  return err;
}

async function openAIResponseError(resp: Response): Promise<Error> {
  const body = await resp.text();
  if (!body) return openAIError(`OpenAI API ${resp.status}`, resp.status);

  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; code?: string }; message?: string };
    return openAIError(parsed.error?.message ?? parsed.message ?? body.slice(0, 200), resp.status);
  } catch {
    return openAIError(body.slice(0, 200), resp.status);
  }
}

function extractOpenAIText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const response = data as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    error?: { message?: string };
  };

  if (typeof response.error?.message === "string") {
    throw new Error(response.error.message);
  }

  if (typeof response.output_text === "string") return response.output_text;

  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function createOpenAIText(model: string, req: AiTextRequest): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI is not configured.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: req.system,
        input: req.input,
        max_output_tokens: req.maxOutputTokens,
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw timeoutError("OpenAI request");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    throw await openAIResponseError(resp);
  }

  const data = await resp.json();
  return extractOpenAIText(data);
}

async function createAITextWithFallback(req: AiTextRequest, logLabel: string): Promise<{ text: string; provider: string; model: string }> {
  let lastError: unknown;

  if (AI_PROVIDER !== "anthropic" && process.env.OPENAI_API_KEY) {
    for (const model of configuredOpenAIModels()) {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const text = await createOpenAIText(model, req);
          if (text.trim()) return { text, provider: "openai", model };
          throw openAIError("OpenAI returned an empty response.");
        } catch (err) {
          lastError = err;
          logger.warn({ err, model, attempt }, `${logLabel} failed with OpenAI`);

          if (!isRetryableProviderError(err)) break;
          await wait(350 * attempt);
        }
      }
    }
  }

  if (ENABLE_ANTHROPIC_FALLBACK) {
    try {
      const { message, model } = await createAnthropicMessageWithFallback({
        max_tokens: req.maxOutputTokens,
        ...(req.system ? { system: req.system } : {}),
        messages: [{ role: "user", content: req.input }],
      }, logLabel);
      const block = message.content[0];
      const text = block && block.type === "text" ? block.text ?? "" : "";
      if (text.trim()) return { text, provider: "anthropic", model };
    } catch (err) {
      lastError = err;
      logger.warn({ err, models: configuredAnthropicModels() }, `${logLabel} failed with Anthropic`);
    }
  }

  throw lastError ?? new Error(`${logLabel} failed with every AI provider.`);
}

function fallbackTurn(ctx: TurnContext): TurnDecision {
  const participantText = ctx.participantText.trim();
  const canFollowUp = ctx.followUpsAsked < MAX_FOLLOW_UPS_PER_QUESTION;

  if (canFollowUp && participantText.length > 0) {
    const lower = participantText.toLowerCase();
    const wantsToStop = participantWantsToStop(lower);
    const asksQuestion =
      /\b(i have (one )?question|can i ask|question from you|ask you|what about|why|how do you)\b/.test(lower);
    const isVeryShort = participantText.split(/\s+/).filter(Boolean).length < 8;
    const isNegative =
      /\b(not good|not working|bad|difficult|hard|frustrating|problem|issue|struggle|annoying|poor|slow|confusing|hate|avoid)\b/.test(lower);
    const wantsSomething =
      /\b(want|need|wish|prefer|expect|should|could|better|improve|missing)\b/.test(lower);

    if (wantsToStop) {
      return {
        aiQuestion: "Of course. We can pause here. Thank you for taking the time to speak with me today.",
        action: "wrap_up",
        isFinal: true,
      };
    }

    return {
      aiQuestion: asksQuestion
        ? "Sure, go ahead. What would you like to ask before we continue?"
        : isNegative
        ? "I hear you, that does not sound like a good experience. What part of it creates the biggest problem for you?"
        : wantsSomething
          ? "That is useful to hear. What would make that feel better or easier for you?"
          : isVeryShort
            ? "Got it. Could you tell me a bit more about what happened there?"
            : "That is helpful to know. Could you share a specific example of that?",
      action: "follow_up",
      isFinal: false,
    };
  }

  const nextQuestion = ctx.questions[ctx.questionIndex + 1];
  if (nextQuestion) {
    return {
      aiQuestion: nextQuestion,
      action: "next_question",
      isFinal: false,
    };
  }

  return {
    aiQuestion: "Thank you so much for your time today. This has been genuinely helpful, and I really appreciate you sharing your thoughts with me.",
    action: "wrap_up",
    isFinal: true,
  };
}

function participantWantsToStop(text: string): boolean {
  return /\b(talk later|later|pause|stop|end|leave|bye|not now|can't continue|cannot continue)\b/.test(text);
}

function nextMainQuestionOrWrap(ctx: TurnContext): TurnDecision {
  const nextQuestion = ctx.questions[ctx.questionIndex + 1];
  if (nextQuestion) {
    return {
      aiQuestion: nextQuestion,
      action: "next_question",
      isFinal: false,
    };
  }

  return {
    aiQuestion: "Thank you so much for your time today. This has been genuinely helpful, and I really appreciate you sharing your thoughts with me.",
    action: "wrap_up",
    isFinal: true,
  };
}

export async function generateNextTurn(ctx: TurnContext): Promise<TurnDecision> {
  const remainingQuestions = ctx.questions.slice(ctx.questionIndex + 1);
  const currentQuestion = ctx.questions[ctx.questionIndex];
  const isLastQuestion = remainingQuestions.length === 0;
  const canFollowUp = ctx.followUpsAsked < MAX_FOLLOW_UPS_PER_QUESTION;
  const participantText = ctx.participantText.trim();
  const wantsToStop = participantWantsToStop(participantText.toLowerCase());

  if (wantsToStop) {
    return {
      aiQuestion: "Of course. We can pause here. Thank you for taking the time to speak with me today.",
      action: "wrap_up",
      isFinal: true,
    };
  }

  if (!canFollowUp) {
    return nextMainQuestionOrWrap(ctx);
  }

  const transcript = ctx.history
    .map((t) => `${t.speaker === "ai" ? "Moderator" : "Participant"}: ${t.text}`)
    .join("\n");

  const systemPrompt = `You are an expert UX researcher and conversational AI conducting a live voice interview about "${ctx.product}".
Research goal: ${ctx.goal}

LANGUAGE RULE — this is the most important instruction:
- Default language: English.
- If the participant speaks in a different language, immediately switch to that language and continue in it.
- If the participant explicitly requests a language change (e.g. "speak in Hindi", "en français s'il vous plaît", "please switch to Spanish"), switch to that language immediately and stay in it for the rest of the interview.
- Match their accent/dialect when possible (e.g. "Hindi" → respond in Hindi script; "Spanish" → Español; "French" → Français).
- Once switched, do NOT revert to English unless the participant asks.

You are warm, intelligent, and genuinely curious, like a thoughtful human female colleague having a real conversation. You:
- Actually LISTEN to what the participant says and respond to it meaningfully
- Acknowledge their specific words before moving on
- Ask natural follow-up questions that dig into what they just said
- Handle tangents gracefully: gently bring it back on topic
- If they ask you a question, answer it honestly then redirect
- Sound like a real warm person, not a survey bot, vary your phrasing
- Keep responses to 1 to 3 sentences maximum

SPEECH FORMAT — your response will be read aloud word-for-word by a text-to-speech engine. The participant hears only what you write. Any formatting will be read as noise or cause the voice to stutter and stop. Follow these rules without exception:
- Plain spoken sentences ONLY. Imagine dictating to someone on the phone.
- NEVER use markdown: no asterisks (*), underscores (_), backticks, hashtags (#), or tilde (~).
- NEVER use dashes as bullets or separators. No hyphens at the start of a line.
- NEVER use em dashes (—) or en dashes (–). Replace with a comma or period.
- NEVER use ellipsis (…) or three dots (...). End thoughts with a period or question mark.
- NEVER use emojis, emoticons, arrows (→ ← ↑ ↓), or any Unicode symbols.
- NEVER use brackets [ ], curly braces { }, angle brackets < >, or parentheses ( ).
- NEVER use numbered lists (1. 2. 3.) or lettered lists (a. b. c.). Speak in flowing sentences.
- NEVER use colons or semicolons to introduce lists. Use "and" or "also" instead.
- Spell out numbers and units where natural: say "three minutes" not "3 mins".
- Only allowed punctuation: period (.), comma (,), question mark (?), exclamation mark (!), apostrophe ('), and quotation marks when quoting speech.
- If writing in a non-Latin script (Hindi, Arabic, Chinese, etc.) follow the same rules — no formatting characters, only natural prose punctuation for that language.

Interview structure:
- The app asks one prefilled research question.
- After the participant answers, you write an answer-aware follow-up.
- The app asks exactly two follow-up questions for each prefilled research question.
- The app decides when to move to the next prefilled research question.
- For this turn, action must be "follow_up" and you must not ask the next prefilled research question.
For this turn, respond to what the participant specifically said, then ask one short open-ended follow-up question.
Do not ask the next prefilled research question.

Respond ONLY with strict JSON: {"action": "follow_up" | "next_question" | "wrap_up", "question": "..."}
The "question" field MUST:
- Be in whichever language you are currently speaking.
- Contain ONLY plain spoken prose — no markdown, no symbols, no formatting, no special characters. It will be read aloud character by character by a TTS engine. Any non-speech character will ruin the audio.`;

  const userPrompt = `You are on question ${ctx.questionIndex + 1} of ${ctx.questions.length}.

Current research topic (question ${ctx.questionIndex + 1}): "${currentQuestion}"
${isLastQuestion ? "This is the LAST question." : `Next research topic (question ${ctx.questionIndex + 2}): "${ctx.questions[ctx.questionIndex + 1]}"`}

Follow-ups used on this topic: ${ctx.followUpsAsked} / ${MAX_FOLLOW_UPS_PER_QUESTION}
${!canFollowUp ? "You MUST NOT pick follow_up — you've reached the follow-up limit for this topic." : ""}
${isLastQuestion && !canFollowUp ? "This is the last topic AND follow-ups are exhausted — you MUST pick wrap_up." : ""}

Full conversation so far:
${transcript}

Participant just responded: "${ctx.participantText}"

The app requires follow-up question ${ctx.followUpsAsked + 1} of ${MAX_FOLLOW_UPS_PER_QUESTION} for this prefilled research question. Do not move to the next prefilled question yet.

Write the next answer-aware follow-up only.
Respond with JSON only, with action set to "follow_up". The "question" value must be plain spoken prose with no special characters, symbols, or formatting because it will be read aloud by a TTS voice.`;

  let raw = "";
  try {
    ({ text: raw } = await createAITextWithFallback({
      maxOutputTokens: 600,
      system: systemPrompt,
      input: userPrompt,
    }, "AI turn generation"));
  } catch (err) {
    logger.error(
      { err, openAIModels: configuredOpenAIModels(), anthropicModels: configuredAnthropicModels() },
      "All AI turn generation attempts failed",
    );
    return fallbackTurn(ctx);
  }

  let parsed: { action: string; question: string } | null = null;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {
    parsed = null;
  }

  if (!parsed || typeof parsed.question !== "string" || parsed.question.length === 0) {
    return fallbackTurn(ctx);
  }

  return {
    aiQuestion: parsed.question,
    action: "follow_up",
    isFinal: false,
  };
}

function uniqueNonEmpty(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const cleaned = item.trim().replace(/\s+/g, " ");
    if (!cleaned || seen.has(cleaned.toLowerCase())) continue;
    seen.add(cleaned.toLowerCase());
    result.push(cleaned);
  }

  return result;
}

function fallbackInsightsFromTranscript(
  product: string,
  goal: string,
  history: { speaker: "ai" | "participant"; text: string }[],
): InsightResult {
  const participantTexts = history
    .filter((turn) => turn.speaker === "participant")
    .map((turn) => turn.text.trim())
    .filter(Boolean);
  const combined = participantTexts.join(" ");
  const negative = participantTexts.filter((text) =>
    /\b(not good|not working|bad|difficult|hard|frustrating|problem|issue|struggle|annoying|poor|slow|confusing|hate|avoid)\b/i.test(text),
  );
  const wants = participantTexts.filter((text) =>
    /\b(want|need|wish|prefer|expect|should|could|better|improve|missing|feature)\b/i.test(text),
  );

  const painPoints = uniqueNonEmpty([
    ...negative.map((text) => `Participant reported a difficult experience: "${text.slice(0, 140)}"`),
    participantTexts.length === 0
      ? "No participant answers were captured in the transcript."
      : "The transcript needs deeper probing because some answers are short or low detail.",
  ]).slice(0, 5);

  const userGoals = uniqueNonEmpty([
    ...wants.map((text) => `Participant indicated a desired improvement: "${text.slice(0, 140)}"`),
    `Understand whether ${product} supports the participant's current workflow and expectations.`,
    `Identify what would make the experience feel successful for the participant.`,
  ]).slice(0, 5);

  const featureRequests = uniqueNonEmpty(
    wants.map((text) => `Explore product changes related to: "${text.slice(0, 140)}"`),
  ).slice(0, 5);

  const recommendations = uniqueNonEmpty([
    "Run a follow-up interview that asks for concrete examples, frequency, and impact of each problem.",
    "Review the shortest participant answers and add moderator follow-ups where the underlying reason is unclear.",
    `Compare these findings against the study goal: ${goal}`,
  ]).slice(0, 5);

  return {
    summary: participantTexts.length > 0
      ? `The participant discussed their experience with ${product}. Key captured input included: "${combined.slice(0, 220)}${combined.length > 220 ? "..." : ""}"`
      : `The transcript for ${product} did not contain participant answers yet, so only a basic analysis could be produced.`,
    painPoints,
    userGoals,
    featureRequests,
    recommendations,
  };
}

export async function generateInsightsFromTranscript(
  product: string,
  goal: string,
  history: { speaker: "ai" | "participant"; text: string }[],
): Promise<InsightResult> {
  const transcript = history
    .map((t) => `${t.speaker === "ai" ? "Moderator" : "Participant"}: ${t.text}`)
    .join("\n");

  const prompt = `Analyze the following UX interview transcript about "${product}".
Research goal: ${goal}

Transcript:
${transcript}

Extract structured insights. Respond ONLY with strict JSON in this shape:
{
  "summary": "2-3 sentence neutral summary of what the participant told us",
  "painPoints": ["..."],
  "userGoals": ["..."],
  "featureRequests": ["..."],
  "recommendations": ["..."]
}

Each array should contain 2-5 concise, specific, evidence-based bullets grounded in what the participant actually said. Recommendations should be actionable next steps for the product team.`;

  let raw = "";
  try {
    ({ text: raw } = await createAITextWithFallback({
      maxOutputTokens: 8192,
      input: prompt,
    }, "AI insight generation"));
  } catch (err) {
    logger.error(
      { err, openAIModels: configuredOpenAIModels(), anthropicModels: configuredAnthropicModels() },
      "All AI insight generation attempts failed",
    );
    return fallbackInsightsFromTranscript(product, goal, history);
  }

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      painPoints: Array.isArray(parsed.painPoints) ? parsed.painPoints.filter((s: unknown) => typeof s === "string") : [],
      userGoals: Array.isArray(parsed.userGoals) ? parsed.userGoals.filter((s: unknown) => typeof s === "string") : [],
      featureRequests: Array.isArray(parsed.featureRequests) ? parsed.featureRequests.filter((s: unknown) => typeof s === "string") : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.filter((s: unknown) => typeof s === "string") : [],
    };
  } catch {
    return fallbackInsightsFromTranscript(product, goal, history);
  }
}

export function buildGreeting(product: string): string {
  return `Hi there, thanks so much for joining today. I am an AI research assistant and I will be chatting with you about your experience with ${product}. There are no right or wrong answers here, I am just genuinely curious about what you think and feel. You can also ask me to switch to any language you are comfortable in at any time. Ready to begin?`;
}
