export interface NanoBananaResponse {
  imageUrl?: string;
  base64?: string;
  error?: string;
}

export type NanoBananaModelPref = "best" | "fast" | "v2";
export type NanoBananaAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export interface NanoBananaGenerateOptions {
  modelPref?: NanoBananaModelPref;
  aspectRatio?: NanoBananaAspectRatio;
  width?: number;
  height?: number;
  steps?: number;
  characterImages?: string[]; // max 4 reference images
}

function isGoogleGenerativeLanguageUrl(url: URL) {
  return url.hostname === "generativelanguage.googleapis.com";
}

function isNanobnanaComUrl(url: URL) {
  return url.hostname === "nanobnana.com";
}

/** data URL이면 순수 base64만 추출, URL이면 그대로. 백엔드 호환용. */
function normalizeReferenceImage(img: string): string {
  const s = typeof img === "string" ? img.trim() : "";
  if (!s) return s;
  const dataUrlMatch = s.match(/^data:image\/[^;]+;base64,(.+)$/i);
  if (dataUrlMatch) return dataUrlMatch[1];
  return s;
}

/** data URL → { mimeType, base64 }, http URL이면 null (Gemini는 inlineData만 지원) */
function refToInlinePart(img: string): { mimeType: string; data: string } | null {
  const s = typeof img === "string" ? img.trim() : "";
  if (!s) return null;
  const dataUrlMatch = s.match(/^data:(image\/[^;]+);base64,(.+)$/i);
  if (dataUrlMatch) {
    const mime = dataUrlMatch[1].toLowerCase();
    return { mimeType: mime === "image/jpg" ? "image/jpeg" : mime, data: dataUrlMatch[2] };
  }
  return null;
}

type GoogleModel = {
  name?: string; // e.g. "models/imagen-3.0-generate-002"
  supportedGenerationMethods?: string[]; // e.g. ["generateImages"]
};

async function fetchTextOrJsonSnippet(response: Response) {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.length > 1200 ? trimmed.slice(0, 1200) + " …" : trimmed;
}

function parseFirstBase64FromGoogleImageResponse(data: any): string | null {
  // Try to be resilient to response shape variations.
  const candidates: unknown[] = [];

  // generateImages shapes
  candidates.push(data?.generatedImages?.[0]?.bytesBase64Encoded);
  candidates.push(data?.generatedImages?.[0]?.image?.bytesBase64Encoded);
  candidates.push(data?.generatedImages?.[0]?.image?.imageBytes);
  candidates.push(data?.images?.[0]?.bytesBase64Encoded);
  candidates.push(data?.images?.[0]?.imageBytes);

  // predict shapes
  candidates.push(data?.predictions?.[0]?.bytesBase64Encoded);
  candidates.push(data?.predictions?.[0]?.image?.bytesBase64Encoded);
  candidates.push(data?.predictions?.[0]?.image);
  candidates.push(data?.predictions?.[0]?.b64_json);

  // OpenAI-ish fallback
  candidates.push(data?.data?.[0]?.b64_json);

  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return null;
}

async function listGoogleModels(apiKey: string, baseUrl: URL): Promise<GoogleModel[]> {
  const url = new URL("/v1beta/models", baseUrl.origin);
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    const snippet = await fetchTextOrJsonSnippet(res);
    throw new Error(`Google ListModels error ${res.status}: ${snippet}`);
  }
  const data = await res.json();
  return Array.isArray(data?.models) ? (data.models as GoogleModel[]) : [];
}

async function callGoogleGenerateImages(
  prompt: string,
  apiKey: string,
  baseUrl: URL,
  modelName: string,
  method: "generateImages" | "predict",
  options?: NanoBananaGenerateOptions
) {
  const path =
    method === "generateImages"
      ? `/v1beta/${modelName}:generateImages`
      : `/v1beta/${modelName}:predict`;
  const url = new URL(path, baseUrl.origin);
  url.searchParams.set("key", apiKey);

  // 주의: Google generateImages/predict API에는 레퍼런스 이미지(characterImages) 필드가 없음.
  // options.characterImages는 여기서 사용하지 않음 → 캐릭터 일관성은 커스텀 나노 바나나 백엔드 사용 시에만 적용됨.
  const body =
    method === "generateImages"
      ? {
          prompt: { text: prompt },
          ...(options?.aspectRatio
            ? { imageGenerationConfig: { numberOfImages: 1, aspectRatio: options.aspectRatio } }
            : { imageGenerationConfig: { numberOfImages: 1 } }),
        }
      : {
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            ...(typeof options?.width === "number" ? { width: options.width } : {}),
            ...(typeof options?.height === "number" ? { height: options.height } : {}),
            ...(typeof options?.steps === "number"
              ? { num_inference_steps: options.steps }
              : {}),
          },
        };

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const snippet = await fetchTextOrJsonSnippet(res);
    // Free tier keys often get blocked for Imagen image generation.
    if (/only available on paid plans/i.test(snippet) || /upgrade your account/i.test(snippet)) {
      throw new Error(
        `${method} ${res.status} (${modelName}): Google Imagen은 유료 플랜/결제 연결이 필요합니다. ` +
          `Google AI Studio에서 프로젝트 결제(Plan/Billing)를 활성화한 뒤 다시 시도해주세요. ` +
          `원문: ${snippet}`
      );
    }
    throw new Error(`${method} ${res.status} (${modelName}): ${snippet}`);
  }

  const data = await res.json();
  const b64 = parseFirstBase64FromGoogleImageResponse(data);
  if (!b64) return { error: `Unknown response format from Google (${method})` };
  return { base64: b64 };
}

function rankGoogleImagenModel(modelName: string) {
  // Higher is better.
  // Examples:
  // - models/imagen-3.0-generate-002
  // - models/imagen-3.0-fast-generate-001
  // - models/imagen-2.0-generate-001
  const lower = modelName.toLowerCase();
  const isFast = lower.includes("fast");

  const verMatch = lower.match(/imagen-(\d+)(?:\.(\d+))?/);
  const major = verMatch ? Number(verMatch[1]) : 0;
  const minor = verMatch && verMatch[2] ? Number(verMatch[2]) : 0;

  // revision like -002 / -001 at end
  const revMatch = lower.match(/-(\d{3})$/);
  const rev = revMatch ? Number(revMatch[1]) : 0;

  // Prefer "generate" models when available
  const hasGenerate = lower.includes("generate");

  return {
    major,
    minor,
    rev,
    hasGenerate,
    isFast,
  };
}

function pickBestImagenModel(
  candidates: Array<{ name: string; methods: string[] }>,
  method: "generateImages" | "predict",
  prefOverride?: NanoBananaModelPref
): string | null {
  const pref = (
    prefOverride ||
    ((process.env.NANO_BANANA_GOOGLE_PREF || "best").trim().toLowerCase() as NanoBananaModelPref)
  )
    .trim()
    .toLowerCase();
  const filtered = candidates.filter((c) => c.methods.includes(method));
  if (filtered.length === 0) return null;

  const isV2Only = pref === "v2" || pref === "imagen2" || pref === "2";
  const isFastPreferred = pref === "fast" || pref === "speed";

  const narrowed = isV2Only
    ? filtered.filter((c) => /imagen-2\b/i.test(c.name))
    : filtered;

  const list = narrowed.length > 0 ? narrowed : filtered;

  list.sort((a, b) => {
    const ra = rankGoogleImagenModel(a.name);
    const rb = rankGoogleImagenModel(b.name);

    // Prefer higher major/minor/rev
    if (ra.major !== rb.major) return rb.major - ra.major;
    if (ra.minor !== rb.minor) return rb.minor - ra.minor;
    if (ra.rev !== rb.rev) return rb.rev - ra.rev;

    // Prefer generate variants
    if (ra.hasGenerate !== rb.hasGenerate) return ra.hasGenerate ? -1 : 1;

    // Quality vs speed preference
    if (ra.isFast !== rb.isFast) {
      if (isFastPreferred) return ra.isFast ? -1 : 1;
      return ra.isFast ? 1 : -1;
    }

    // Stable fallback: lexical
    return a.name.localeCompare(b.name);
  });

  return list[0].name;
}

async function generateImageViaGoogleImagen(prompt: string, apiKey: string, baseUrl: URL) {
  // Strategy:
  // - Try a few known Imagen model names with generateImages first.
  // - If not found / not supported, ListModels and pick an Imagen model that supports generateImages or predict.

  const knownModelNames = [
    "models/imagen-3.0-generate-002",
    "models/imagen-3.0-generate-001",
    "models/imagen-3.0-fast-generate-001",
    "models/imagen-2.0-generate-001",
  ];

  const errors: string[] = [];

  for (const modelName of knownModelNames) {
    try {
      return await callGoogleGenerateImages(
        prompt,
        apiKey,
        baseUrl,
        modelName,
        "generateImages",
        undefined
      );
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  // Fall back to model discovery
  const models = await listGoogleModels(apiKey, baseUrl);
  const imagenCandidates = models
    .filter((m) => typeof m.name === "string" && m.name.includes("imagen"))
    .map((m) => ({
      name: m.name as string,
      methods: Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [],
    }));

  const generateImagesModel = pickBestImagenModel(imagenCandidates, "generateImages");
  if (generateImagesModel) {
    return await callGoogleGenerateImages(
      prompt,
      apiKey,
      baseUrl,
      generateImagesModel,
      "generateImages",
      undefined
    );
  }

  const predictModel = pickBestImagenModel(imagenCandidates, "predict");
  if (predictModel) {
    return await callGoogleGenerateImages(
      prompt,
      apiKey,
      baseUrl,
      predictModel,
      "predict",
      undefined
    );
  }

  const hint =
    imagenCandidates.length > 0
      ? `발견된 imagen 모델: ${imagenCandidates
          .slice(0, 8)
          .map((m) => `${m.name}(${m.methods.join(",")})`)
          .join(" / ")}`
      : "ListModels에서 imagen 모델을 찾지 못했습니다.";
  throw new Error(
    `Google Imagen 모델을 찾지 못했습니다. ${hint}\n시도한 오류: ${errors.slice(0, 4).join(" | ")}`
  );
}

/** nanobnana.com: POST /api/v2/generate → task_id → poll /api/v2/status */
async function generateImageViaNanobnanaCom(
  prompt: string,
  apiKey: string,
  _url: URL,
  options?: NanoBananaGenerateOptions
): Promise<NanoBananaResponse> {
  const base = "https://nanobnana.com";
  const genUrl = `${base}/api/v2/generate`;

  const refImages = (options?.characterImages ?? []).slice(0, 4).filter((s) => typeof s === "string" && s.trim());
  const maxSide = Math.max(options?.width ?? 1024, options?.height ?? 1024);
  const size = maxSide >= 2048 ? "4K" : maxSide >= 1024 ? "2K" : "1K";

  const body: Record<string, unknown> = {
    prompt,
    aspect_ratio: options?.aspectRatio ?? "1:1",
    size,
    format: "png",
  };
  if (refImages.length > 0) {
    body.images = refImages;
  }

  const res = await fetch(genUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: { code?: number; message?: string; data?: { task_id?: string } };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Nano Banana(nanobnana.com) 응답 파싱 실패: ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    const msg = data?.message || text.slice(0, 300);
    throw new Error(`Nano Banana(nanobnana.com) ${res.status}: ${msg}`);
  }

  const taskId = data?.data?.task_id;
  if (!taskId) {
    return { error: "nanobnana.com: task_id를 받지 못했습니다." };
  }

  const statusUrl = `${base}/api/v2/status?task_id=${encodeURIComponent(taskId)}`;
  const maxAttempts = 60;
  const intervalMs = 2000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, i === 0 ? 3000 : intervalMs));

    const statusRes = await fetch(statusUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const statusText = await statusRes.text();
    let statusData: {
      code?: number;
      data?: { status?: number; response?: string | null; error_message?: string | null };
    };
    try {
      statusData = JSON.parse(statusText);
    } catch {
      continue;
    }

    const d = statusData?.data;
    if (!d) continue;

    if (d.status === -1) {
      return { error: d.error_message || "nanobnana.com 생성 실패" };
    }
    if (d.status === 1 && d.response) {
      try {
        const urls = JSON.parse(d.response) as string[];
        const imageUrl = Array.isArray(urls) && urls[0] ? urls[0] : null;
        if (imageUrl) return { imageUrl };
      } catch {
        return { error: "nanobnana.com: 이미지 URL 파싱 실패" };
      }
    }
  }

  return { error: "nanobnana.com: 제한 시간 내에 완료되지 않았습니다." };
}

/** Google Gemini generateContent: 레퍼런스 이미지(최대 4장) 포함 → 캐릭터 일관성 지원 */
async function callGoogleGeminiGenerateContentWithRefs(
  prompt: string,
  apiKey: string,
  baseUrl: URL,
  options?: NanoBananaGenerateOptions
): Promise<NanoBananaResponse> {
  const refParts: { inlineData: { mimeType: string; data: string } }[] = [];
  for (const img of (options?.characterImages ?? []).slice(0, 4)) {
    const part = refToInlinePart(img);
    if (part) refParts.push({ inlineData: part });
  }
  if (refParts.length === 0) return { error: "Google 레퍼런스: data URL 형식 이미지가 필요합니다." };

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: prompt },
    ...refParts,
  ];

  const aspectRatio = options?.aspectRatio ?? "1:1";
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio,
        imageSize: "2K",
      },
    },
  };

  const path = "/v1beta/models/gemini-3.1-flash-image-preview:generateContent";
  const url = new URL(path, baseUrl.origin);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    const snippet = text.trim().slice(0, 600);
    if (/only available on paid plans/i.test(snippet) || /upgrade your account/i.test(snippet)) {
      throw new Error(
        `Google Gemini 이미지 생성은 유료 플랜/결제 연결이 필요합니다. ` +
          `프로젝트 결제를 활성화한 뒤 다시 시도해주세요. 원문: ${snippet}`
      );
    }
    throw new Error(`Google Gemini generateContent ${res.status}: ${snippet}`);
  }

  let data: { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string }; text?: string }> } }> };
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "Google Gemini 응답 파싱 실패" };
  }

  const candidate = data?.candidates?.[0];
  const partsOut = candidate?.content?.parts ?? [];
  for (const part of partsOut) {
    if (part?.inlineData?.data) return { base64: part.inlineData.data };
  }
  return { error: "Google Gemini: 생성된 이미지를 찾을 수 없습니다." };
}

export async function generateImage(
  prompt: string,
  apiKey: string,
  apiUrl: string,
  options?: NanoBananaGenerateOptions
): Promise<NanoBananaResponse> {
  let url: URL;
  try {
    url = new URL(apiUrl);
  } catch {
    throw new Error(`Nano Banana API URL이 올바르지 않습니다: ${apiUrl}`);
  }

  if (isNanobnanaComUrl(url)) {
    return await generateImageViaNanobnanaCom(prompt, apiKey, url, options);
  }

  if (isGoogleGenerativeLanguageUrl(url)) {
    try {
      const hasRefs = (options?.characterImages?.length ?? 0) > 0;
      const refsAreDataUrls = (options?.characterImages ?? []).slice(0, 4).some((s) =>
        /^data:image\/[^;]+;base64,/i.test(String(s).trim())
      );
      if (hasRefs && refsAreDataUrls) {
        return await callGoogleGeminiGenerateContentWithRefs(prompt, apiKey, url, options);
      }
      // 레퍼런스 없을 때만 Imagen 경로 사용
      const models = await listGoogleModels(apiKey, url);
      const imagenCandidates = models
        .filter((m) => typeof m.name === "string" && m.name.includes("imagen"))
        .map((m) => ({
          name: m.name as string,
          methods: Array.isArray(m.supportedGenerationMethods)
            ? m.supportedGenerationMethods
            : [],
        }));

      const genModel = pickBestImagenModel(
        imagenCandidates,
        "generateImages",
        options?.modelPref
      );
      if (genModel) {
        return await callGoogleGenerateImages(
          prompt,
          apiKey,
          url,
          genModel,
          "generateImages",
          options
        );
      }

      const predModel = pickBestImagenModel(
        imagenCandidates,
        "predict",
        options?.modelPref
      );
      if (predModel) {
        return await callGoogleGenerateImages(
          prompt,
          apiKey,
          url,
          predModel,
          "predict",
          options
        );
      }

      // fall back to previous heuristic if listModels returned unexpected shapes
      return await generateImageViaGoogleImagen(prompt, apiKey, url);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Nano Banana(Google) 호출 실패: ${message}`);
    }
  }

  const refImages = (options?.characterImages ?? [])
    .slice(0, 4)
    .map(normalizeReferenceImage)
    .filter((s) => s.length > 0);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (apiKey.trim()) {
    headers["X-API-Key"] = apiKey.trim();
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt,
        width: options?.width ?? 1024,
        height: options?.height ?? 1024,
        num_inference_steps: options?.steps ?? 30,
        ...(refImages.length > 0 ? { character_images: refImages } : {}),
      }),
    });
  } catch (err) {
    const anyErr = err as { message?: string; cause?: unknown };
    const cause = anyErr?.cause as { code?: string; message?: string } | undefined;
    const detail = cause?.code || cause?.message || anyErr?.message || String(err);
    throw new Error(`Nano Banana 네트워크 오류 (${url.origin}): ${detail}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    const trimmed = errorText.trim();
    const isHtml = /^<!doctype html|^<html\b/i.test(trimmed);
    if (isHtml) {
      throw new Error(
        `Nano Banana API error ${response.status} (${url.host}${url.pathname}): HTML 응답을 받았습니다. API URL이 올바른 엔드포인트인지 확인해주세요.`
      );
    }
    const snippet = trimmed.length > 800 ? trimmed.slice(0, 800) + " …" : trimmed;
    throw new Error(
      `Nano Banana API error ${response.status} (${url.host}${url.pathname}): ${snippet}`
    );
  }

  const data = await response.json();

  if (data.url) return { imageUrl: data.url };
  if (data.image_url) return { imageUrl: data.image_url };
  if (data.images?.[0]?.url) return { imageUrl: data.images[0].url };
  if (data.images?.[0]?.base64) return { base64: data.images[0].base64 };
  if (data.base64) return { base64: data.base64 };

  return { error: "Unknown response format from Nano Banana API" };
}
