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
}

function isGoogleGenerativeLanguageUrl(url: URL) {
  return url.hostname === "generativelanguage.googleapis.com";
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

  if (isGoogleGenerativeLanguageUrl(url)) {
    try {
      // Use options to influence model selection and aspect ratio when possible.
      // For Google generateImages, we apply aspectRatio. "resolution" support varies by API.
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

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        width: options?.width ?? 1024,
        height: options?.height ?? 1024,
        num_inference_steps: options?.steps ?? 30,
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
