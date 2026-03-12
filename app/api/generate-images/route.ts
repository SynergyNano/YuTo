import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/nanoBananaClient";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, apiKey, options, characterImages } = body as {
      prompt: string;
      apiKey: string;
      options?: {
        modelPref?: "best" | "fast" | "v2";
        aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
        width?: number;
        height?: number;
        steps?: number;
      };
      characterImages?: string[];
    };

    if (!prompt) {
      return NextResponse.json({ error: "Missing required field: prompt" }, { status: 400 });
    }

    const resolvedKey = apiKey || process.env.NANO_BANANA_API_KEY || "";
    const resolvedUrl = process.env.NANO_BANANA_API_URL || "";

    if (!resolvedKey) {
      return NextResponse.json(
        { error: "나노 바나나 API 키가 없습니다. 설정에서 API 키를 입력해주세요." },
        { status: 400 }
      );
    }

    if (!resolvedUrl) {
      return NextResponse.json(
        { error: "나노 바나나 API URL이 없습니다. 설정에서 URL을 입력해주세요." },
        { status: 400 }
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(resolvedUrl);
    } catch {
      return NextResponse.json(
        { error: `NANO_BANANA_API_URL 형식이 올바르지 않습니다: ${resolvedUrl}` },
        { status: 400 }
      );
    }

    const isGoogle = parsed.hostname === "generativelanguage.googleapis.com";
    if (!isGoogle && parsed.pathname === "/" && !parsed.search) {
      return NextResponse.json(
        {
          error:
            `NANO_BANANA_API_URL은 루트가 아니라 실제 생성 엔드포인트까지 포함해야 합니다. ` +
            `예: https://.../v1/generate (현재: ${resolvedUrl})`,
        },
        { status: 400 }
      );
    }

    const width =
      typeof options?.width === "number" && Number.isFinite(options.width)
        ? Math.round(options.width)
        : undefined;
    const height =
      typeof options?.height === "number" && Number.isFinite(options.height)
        ? Math.round(options.height)
        : undefined;
    const steps =
      typeof options?.steps === "number" && Number.isFinite(options.steps)
        ? Math.round(options.steps)
        : undefined;

    if (width !== undefined && (width < 256 || width > 2048)) {
      return NextResponse.json({ error: "width는 256~2048 범위여야 합니다." }, { status: 400 });
    }
    if (height !== undefined && (height < 256 || height > 2048)) {
      return NextResponse.json({ error: "height는 256~2048 범위여야 합니다." }, { status: 400 });
    }
    if (steps !== undefined && (steps < 1 || steps > 80)) {
      return NextResponse.json({ error: "steps는 1~80 범위여야 합니다." }, { status: 400 });
    }

    const result = await generateImage(prompt, resolvedKey, resolvedUrl, {
      modelPref: options?.modelPref,
      aspectRatio: options?.aspectRatio,
      width,
      height,
      steps,
      characterImages: Array.isArray(characterImages) ? characterImages.slice(0, 4) : undefined,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
