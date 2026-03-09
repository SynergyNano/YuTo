import { NextRequest, NextResponse } from "next/server";
import { generatePromptsForChapter } from "@/lib/llmClient";
import type { ImagePrompt } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      chapterNumber,
      chapterContent,
      sceneCount,
      claudeApiKey,
      customSystemPrompt,
      storyContext,
    } =
      body as {
        chapterNumber: number;
        chapterContent: string;
        sceneCount: number;
        claudeApiKey?: string;
        customSystemPrompt?: string;
        storyContext?: string;
      };

    if (!chapterNumber || !chapterContent || !sceneCount) {
      return NextResponse.json(
        { error: "Missing required fields: chapterNumber, chapterContent, sceneCount" },
        { status: 400 }
      );
    }

    const rawPrompts = await generatePromptsForChapter(
      chapterNumber,
      chapterContent,
      sceneCount,
      { apiKey: claudeApiKey, systemPrompt: customSystemPrompt, storyContext }
    );

    const prompts: ImagePrompt[] = rawPrompts.map((p, i) => ({
      chapterIndex: chapterNumber - 1,
      chapterNumber,
      sceneIndex: i,
      sceneNumber: i + 1,
      label: `【챕터 ${chapterNumber} - 장면 ${i + 1}】`,
      prompt: p,
    }));

    return NextResponse.json({ prompts });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
