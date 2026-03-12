import { NextRequest, NextResponse } from "next/server";
import { extractCharacters } from "@/lib/llmClient";

export async function POST(request: NextRequest) {
  try {
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
