import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { analyzeScript } from "@/lib/llmClient";
import { CHAPTER_COLORS } from "@/lib/chapterParser";
import type { SceneSelection } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "인증되지 않은 요청입니다." }, { status: 401 });
    }

    const body = await request.json();
    const { script, sceneCount, claudeApiKey, customSystemPrompt } = body as {
      script: string;
      sceneCount: number;
      claudeApiKey?: string;
      customSystemPrompt?: string;
    };

    if (!script?.trim()) {
      return NextResponse.json({ error: "대본 내용이 없습니다." }, { status: 400 });
    }

    const count = Math.max(1, Math.min(20, sceneCount || 10));
    const raw = await analyzeScript(script, count, {
      apiKey: claudeApiKey,
      systemPrompt: customSystemPrompt,
    });

    const scenes: SceneSelection[] = raw.map((r, i) => {
      const color = CHAPTER_COLORS[i % CHAPTER_COLORS.length];
      const startIndex = script.indexOf(r.excerpt);
      return {
        number: r.number ?? i + 1,
        excerpt: r.excerpt,
        description: r.description,
        prompt: r.prompt,
        color,
        startIndex,
        endIndex: startIndex >= 0 ? startIndex + r.excerpt.length : -1,
      };
    });

    return NextResponse.json({ scenes });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
