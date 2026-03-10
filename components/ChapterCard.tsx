"use client";

import { useRef } from "react";
import type {
  ChapterWorkspace,
  ChapterImage,
  Chapter,
  GeneratedImage,
} from "@/types";
import ImageGenerator from "@/components/ImageGenerator";

interface ChapterCardProps {
  workspace: ChapterWorkspace;
  onUpdate: (updater: (prev: ChapterWorkspace) => ChapterWorkspace) => void;
  onDelete: () => void;
  claudeApiKey: string;
  customSystemPrompt: string;
  nanoBananaKey: string;
  nanoOptions: {
    modelPref: "best" | "fast" | "v2";
    aspectRatio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
    width: number;
    height: number;
  };
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  idle: { label: "대기중", cls: "bg-gray-100 text-gray-500" },
  generating: { label: "생성 중...", cls: "bg-blue-100 text-blue-600" },
  done: { label: "완료", cls: "bg-emerald-100 text-emerald-600" },
  error: { label: "오류", cls: "bg-red-100 text-red-600" },
};

export default function ChapterCard({
  workspace,
  onUpdate,
  onDelete,
  claudeApiKey,
  customSystemPrompt,
  nanoBananaKey,
  nanoOptions,
}: ChapterCardProps) {
  const imagesRef = useRef<ChapterImage[]>([]);

  // ── Derive status for header badge ──────────────────────────────────────
  const overallStatus =
    workspace.imageStatus === "done" || workspace.imageStatus === "generating"
      ? workspace.imageStatus
      : workspace.imageStatus === "error"
      ? "error"
      : "idle";

  const badge = STATUS_BADGE[overallStatus] ?? STATUS_BADGE.idle;

  // ── Image generation ─────────────────────────────────────────────────────
  async function handleGenerateImages() {
    if (!nanoBananaKey.trim()) {
      onUpdate((prev) => ({
        ...prev,
        imageStatus: "error",
        imageError: "나노 바나나 API 키를 먼저 입력해주세요. (우측 ⚙ 설정)",
      }));
      return;
    }

    const count = Math.min(10, Math.max(1, workspace.imageCount));
    const promptText = (workspace.customPrompt ?? "").trim();
    if (!promptText) return;

    const initialImages: ChapterImage[] = Array.from({ length: count }, (_, i) => ({
      index: i,
      label: `장면 ${i + 1}`,
      imageUrl: null,
      status: "pending",
    }));

    imagesRef.current = initialImages;
    onUpdate((prev) => ({
      ...prev,
      imageStatus: "generating",
      imageError: undefined,
      images: initialImages,
    }));

    for (let i = 0; i < count; i++) {
      imagesRef.current = imagesRef.current.map((img, idx) =>
        idx === i ? { ...img, status: "generating" } : img
      );
      onUpdate((prev) => ({ ...prev, images: imagesRef.current.slice() }));

      try {
        const res = await fetch("/api/generate-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptText,
            apiKey: nanoBananaKey,
            options: nanoOptions,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "이미지 생성 실패");

        const imageUrl =
          data.imageUrl ??
          (data.base64 ? `data:image/png;base64,${data.base64}` : null);

        imagesRef.current = imagesRef.current.map((img, idx) =>
          idx === i ? { ...img, status: "done", imageUrl: imageUrl ?? "" } : img
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        imagesRef.current = imagesRef.current.map((img, idx) =>
          idx === i ? { ...img, status: "error", error: message } : img
        );
      }

      onUpdate((prev) => ({ ...prev, images: imagesRef.current.slice() }));
    }

    onUpdate((prev) => ({ ...prev, imageStatus: "done" }));
  }

  // ── Adapt workspace to ImageGenerator props ──────────────────────────────
  const fakeChapter: Chapter = {
    index: workspace.number - 1,
    number: workspace.number,
    title: `챕터 ${workspace.number}`,
    content: workspace.scriptContent,
    color: workspace.color,
    imageCount: workspace.imageCount,
  };

  const generatedImages: GeneratedImage[] = workspace.images.map((img) => ({
    chapterNumber: workspace.number,
    sceneNumber: img.index + 1,
    label: img.label,
    imageUrl: img.imageUrl,
    status: img.status,
    error: img.error,
  }));

  const isImageGenerating = workspace.imageStatus === "generating";
  const canGenerateImages = !!workspace.customPrompt?.trim();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{
          backgroundColor: workspace.color + "18",
          borderLeft: `4px solid ${workspace.color}`,
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-base font-bold"
            style={{ color: workspace.color }}
          >
            챕터 {workspace.number}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="text-gray-400 hover:text-red-400 text-lg leading-none transition"
          title="챕터 삭제"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4 flex flex-col gap-4">
        {/* Script input */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            대본 텍스트
          </label>
          <textarea
            value={workspace.scriptContent}
            onChange={(e) =>
              onUpdate((prev) => ({ ...prev, scriptContent: e.target.value }))
            }
            placeholder={`챕터 ${workspace.number}의 대본 텍스트를 붙여넣으세요...`}
            rows={6}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Image count + generate prompts */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">
              이미지 수
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={Math.min(10, workspace.imageCount)}
              onChange={(e) =>
                onUpdate((prev) => ({
                  ...prev,
                  imageCount: Math.min(10, Math.max(1, Number(e.target.value))),
                }))
              }
              className="flex-1"
            />
            <span
              className="text-sm font-bold w-6 text-center"
              style={{ color: workspace.color }}
            >
              {Math.min(10, workspace.imageCount)}
            </span>
          </div>
        </div>

        {/* Single custom prompt per chapter */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600">
              이미지 프롬프트 (챕터당 1개)
            </p>
            <button
              type="button"
              onClick={handleGenerateImages}
              disabled={isImageGenerating || !canGenerateImages}
              className="px-4 py-1.5 text-sm rounded-lg text-white hover:opacity-90 disabled:opacity-40 transition flex items-center gap-2"
              style={{ backgroundColor: workspace.color }}
            >
              {isImageGenerating ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  이미지 생성 중...
                </>
              ) : (
                "이미지 생성 시작"
              )}
            </button>
          </div>

          <textarea
            value={workspace.customPrompt ?? ""}
            onChange={(e) =>
              onUpdate((prev) => ({ ...prev, customPrompt: e.target.value }))
            }
            rows={3}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50"
            placeholder="이 챕터 전체에 대해 사용할 이미지 프롬프트를 입력하세요. (이 프롬프트로 여러 이미지를 생성합니다.)"
          />
        </div>

        {/* Image error */}
        {workspace.imageStatus === "error" && workspace.imageError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {workspace.imageError}
          </div>
        )}

        {/* Image grid */}
        {workspace.images.length > 0 && (
          <ImageGenerator
            chapters={[fakeChapter]}
            images={generatedImages}
          />
        )}
      </div>
    </div>
  );
}
