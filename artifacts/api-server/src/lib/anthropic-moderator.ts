import { anthropic } from "@workspace/integrations-anthropic-ai";

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

const MAX_FOLLOW_UPS_PER_QUESTION = 2;

export async function generateNextTurn(ctx: TurnContext): Promise<TurnDecision> {
  const remainingQuestions = ctx.questions.slice(ctx.questionIndex + 1);
  const currentQuestion = ctx.questions[ctx.questionIndex];
  const isLastQuestion = remainingQuestions.length === 0;
  const canFollowUp = ctx.followUpsAsked < MAX_FOLLOW_UPS_PER_QUESTION;

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

Decision:
- "follow_up": the answer was interesting, thin, or leaves something worth exploring — ask one more probing question about what they just said
- "next_question": you have enough depth on this topic — transition naturally into the next research area
- "wrap_up": all topics are covered — close warmly

For "next_question": smooth 1–2 sentence response that briefly acknowledges what they said, then transitions into the next topic naturally. Keep the research intent but make it conversational.
For "follow_up": respond to what they specifically said, then ask one short open-ended probing question.
For "wrap_up": thank them genuinely and close warmly, no more questions.

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

Now decide: should you follow up on what they said, transition to the next research topic, or wrap up?
Respond with JSON only. The "question" value must be plain spoken prose with no special characters, symbols, or formatting — it will be read aloud by a TTS voice.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = message.content[0];
  const raw = block && block.type === "text" ? block.text : "";

  let parsed: { action: string; question: string } | null = null;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {
    parsed = null;
  }

  if (!parsed || typeof parsed.question !== "string" || parsed.question.length === 0) {
    if (!isLastQuestion) {
      return {
        aiQuestion: ctx.questions[ctx.questionIndex + 1]!,
        action: "next_question",
        isFinal: false,
      };
    }
    return {
      aiQuestion: "Thank you so much for your time today — this has been genuinely helpful. I really appreciate you sharing all of this with me.",
      action: "wrap_up",
      isFinal: true,
    };
  }

  let action = parsed.action as "follow_up" | "next_question" | "wrap_up";
  if (action === "follow_up" && !canFollowUp) action = isLastQuestion ? "wrap_up" : "next_question";
  if (action === "next_question" && isLastQuestion) action = "wrap_up";

  return {
    aiQuestion: parsed.question,
    action,
    isFinal: action === "wrap_up",
  };
}

export async function generateInsightsFromTranscript(
  product: string,
  goal: string,
  history: { speaker: "ai" | "participant"; text: string }[],
): Promise<{
  summary: string;
  painPoints: string[];
  userGoals: string[];
  featureRequests: string[];
  recommendations: string[];
}> {
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

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  const raw = block && block.type === "text" ? block.text : "{}";

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
    return { summary: raw.slice(0, 500), painPoints: [], userGoals: [], featureRequests: [], recommendations: [] };
  }
}

export function buildGreeting(product: string): string {
  return `Hi there, thanks so much for joining today. I am an AI research assistant and I will be chatting with you about your experience with ${product}. There are no right or wrong answers here, I am just genuinely curious about what you think and feel. You can also ask me to switch to any language you are comfortable in at any time. Ready to begin?`;
}
