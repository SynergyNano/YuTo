import Anthropic from "@anthropic-ai/sdk";
import {
  SYSTEM_PROMPT,
  buildUserMessage,
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserMessage,
} from "./promptRules";

function getClient(apiKey?: string) {
  return new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
}

function getClaudeModel() {
  return (process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6").trim();
}

// ─── Chapter-based prompt generation ────────────────────────────────────────

export async function generatePromptsForChapter(
  chapterNumber: number,
  chapterContent: string,
  sceneCount: number,
  options?: { apiKey?: string; systemPrompt?: string; storyContext?: string }
): Promise<string[]> {
  const client = getClient(options?.apiKey);
  const systemPrompt = options?.systemPrompt?.trim() || SYSTEM_PROMPT;
  const userMessage = buildUserMessage(
    chapterNumber,
    chapterContent,
    sceneCount,
    false,
    options?.storyContext
  );

  const message = await client.messages.create({
    model: getClaudeModel(),
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  const prompts = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (prompts.length < sceneCount) {
    return text
      .split("\n")
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .slice(0, sceneCount);
  }

  return prompts.slice(0, sceneCount);
}

// ─── Full-script analysis ────────────────────────────────────────────────────

interface RawSceneSelection {
  number: number;
  excerpt: string;
  description: string;
  prompt: string;
}

export async function analyzeScript(
  script: string,
  sceneCount: number,
  options?: { apiKey?: string; systemPrompt?: string }
): Promise<RawSceneSelection[]> {
  const client = getClient(options?.apiKey);
  const systemPrompt = options?.systemPrompt?.trim() || ANALYSIS_SYSTEM_PROMPT;

  const message = await client.messages.create({
    model: getClaudeModel(),
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      { role: "user", content: buildAnalysisUserMessage(script, sceneCount) },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const parsed: RawSceneSelection[] = JSON.parse(cleaned);
  return parsed.slice(0, sceneCount);
}
