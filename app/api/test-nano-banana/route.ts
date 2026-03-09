import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body as { apiKey: string };

    if (!apiKey?.trim()) {
      return NextResponse.json({ error: "API 키를 입력해주세요." }, { status: 400 });
    }

    const apiUrl = process.env.NANO_BANANA_API_URL?.trim();
    if (!apiUrl) {
      return NextResponse.json(
        { error: "서버에 NANO_BANANA_API_URL 환경변수가 설정되지 않았습니다." },
        { status: 400 }
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(apiUrl);
    } catch {
      return NextResponse.json({ error: `올바른 URL 형식이 아닙니다: ${apiUrl}` }, { status: 400 });
    }

    const key = apiKey.trim();
    let res: Response;

    if (parsed.hostname === "generativelanguage.googleapis.com") {
      // lightweight auth check: list models
      const url = new URL("/v1beta/models", parsed.origin);
      url.searchParams.set("key", key);
      res = await fetch(url.toString(), { method: "GET" });
    } else {
      // generic ping: POST to configured endpoint
      res = await fetch(parsed.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ prompt: "test" }),
      });
    }

    const statusCode = res.status;

    if (statusCode === 401 || statusCode === 403) {
      return NextResponse.json(
        { error: `인증 실패 (HTTP ${statusCode}) — API 키를 확인해주세요.` },
        { status: 401 }
      );
    }

    if (statusCode >= 400) {
      return NextResponse.json(
        {
          error:
            `엔드포인트 오류 (HTTP ${statusCode}) — ` +
            `NANO_BANANA_API_URL이 실제 생성 엔드포인트인지 확인해주세요.`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, status: statusCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
