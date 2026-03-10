import { NextResponse } from "next/server";

export async function GET() {
  const model = (process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6").trim();
  return NextResponse.json({ model });
}
