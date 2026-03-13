import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";

function getClaudeModel() {
  return (process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6").trim();
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "인증되지 않은 요청입니다." }, { status: 401 });
    }

    const body = await request.json();
    const { apiKey } = body as { apiKey: string };

    const resolvedKey = apiKey?.trim() || process.env.ANTHROPIC_API_KEY || "";
    if (!resolvedKey) {
      return NextResponse.json({ error: "API 키가 없습니다." }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: resolvedKey });

    const message = await client.messages.create({
      model: getClaudeModel(),
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with: OK" }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ ok: true, model: message.model, reply: text });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
