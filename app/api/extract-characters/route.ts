import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { extractCharacters } from "@/lib/llmClient";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "인증되지 않은 요청입니다." }, { status: 401 });
    }

    const body = await request.json();
    const { script, claudeApiKey } = body as {
      script: string;
      claudeApiKey?: string;
    };

    if (!script?.trim()) {
      return NextResponse.json(
        { error: "Missing required field: script" },
        { status: 400 }
      );
    }

    const characters = await extractCharacters(script, { apiKey: claudeApiKey });
    return NextResponse.json({ characters });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
