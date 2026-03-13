import { NextRequest, NextResponse } from "next/server";
import { generateSingleScenePrompt } from "@/lib/llmClient";
import type { CharacterProfile } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      chapterNumber,
      chapterContent,
      sceneNumber,
      totalScenes,
      claudeApiKey,
      customSystemPrompt,
      storyContext,
      characters,
    } = body as {
      chapterNumber: number;
      chapterContent: string;
      sceneNumber: number;
      totalScenes?: number;
      claudeApiKey?: string;
      customSystemPrompt?: string;
      storyContext?: string;
      characters?: CharacterProfile[];
    };

    if (!chapterNumber || !chapterContent || !sceneNumber) {
      return NextResponse.json(
        { error: "Missing required fields: chapterNumber, chapterContent, sceneNumber" },
        { status: 400 }
      );
    }

    const scene = Math.max(1, Math.floor(sceneNumber));
    const total = Math.max(scene, Math.floor(totalScenes ?? sceneNumber));

    const prompt = await generateSingleScenePrompt(
      chapterNumber,
      chapterContent,
      scene,
      total,
      { apiKey: claudeApiKey, systemPrompt: customSystemPrompt, storyContext, characters }
    );

    return NextResponse.json({ prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

