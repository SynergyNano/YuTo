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
      const url = new URL("/v1beta/models", parsed.origin);
      url.searchParams.set("key", key);
      res = await fetch(url.toString(), { method: "GET" });
    } else if (parsed.hostname === "nanobnana.com") {
      res = await fetch("https://nanobnana.com/api/v2/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          prompt: "test",
          aspect_ratio: "1:1",
          size: "1K",
          format: "png",
        }),
      });
    } else {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      };
      headers["X-API-Key"] = key;
      res = await fetch(parsed.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt: "test",
          width: 1024,
          height: 1024,
          num_inference_steps: 30,
        }),
      });
    }

    const statusCode = res.status;
    const responseText = await res.text();
    let responseSnippet = responseText.trim();
    if (responseSnippet.length > 500) responseSnippet = responseSnippet.slice(0, 500) + "…";

    if (statusCode === 401 || statusCode === 403) {
      return NextResponse.json(
        { error: `인증 실패 (HTTP ${statusCode}) — API 키를 확인해주세요.${responseSnippet ? `\n서버 응답: ${responseSnippet}` : ""}` },
        { status: 401 }
      );
    }

    if (statusCode === 402 || (responseSnippet && /no credit|insufficient credit|credit/i.test(responseSnippet))) {
      return NextResponse.json(
        {
          error:
            "크레딧이 없습니다. 나노 바나나 사이트에서 크레딧을 충전해주세요.\n\n" +
            "• nanobnana.com → Pricing 또는 Billing 메뉴에서 충전",
        },
        { status: 402 }
      );
    }

    if (statusCode >= 400) {
      const isGoogleUrl = parsed.hostname === "generativelanguage.googleapis.com";
      const looksLikeNanoKey = /^sk[-_]/i.test(key);
      let hint = `(HTTP ${statusCode}) NANO_BANANA_API_URL과 API 키를 확인해주세요.`;
      if (isGoogleUrl && looksLikeNanoKey) {
        hint =
          "URL은 Google API인데, 입력한 키는 나노 바나나 키(sk...)입니다. " +
          "나노 바나나 키를 쓰려면 .env의 NANO_BANANA_API_URL을 나노 바나나 사이트에서 안내한 URL로 바꿔주세요.";
      } else if (responseSnippet && /API_KEY_INVALID|API key not valid/i.test(responseSnippet)) {
        hint = "API 키가 서버에서 거부되었습니다. 키가 해당 URL(서비스)용인지 확인해주세요.";
      }
      const serverPart = responseSnippet
        ? `서버 응답: ${responseSnippet}`
        : "";
      return NextResponse.json(
        {
          error: serverPart ? `${serverPart}\n\n${hint}` : hint,
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
