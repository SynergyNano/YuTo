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
  nanoBananaKey: string;
  storyContext?: string;
  defaultImagePrompt?: string;
  characterImages?: string[];
  onImageLightbox?: (url: string) => void;
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
  nanoBananaKey,
  defaultImagePrompt = "",
  characterImages,
  onImageLightbox,
  nanoOptions,
}: ChapterCardProps) {
  const imagesRef = useRef<ChapterImage[]>([]);
  const warningShownRef = useRef(false);

  const overallStatus =
    workspace.imageStatus === "done" || workspace.imageStatus === "generating"
      ? workspace.imageStatus
      : workspace.imageStatus === "error"
      ? "error"
      : "idle";

  const badge = STATUS_BADGE[overallStatus] ?? STATUS_BADGE.idle;

  // 장면별 프롬프트 — scenePrompts 우선, 없으면 customPrompt/defaultImagePrompt 폴백
  function getPromptForScene(index: number): string {
    const scenes = workspace.scenePrompts;
    if (scenes && scenes.length > index && scenes[index]?.trim()) {
      return scenes[index];
    }
    return (workspace.customPrompt || defaultImagePrompt).trim();
  }

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
    const fallbackPrompt = (workspace.customPrompt || defaultImagePrompt).trim();
    const hasAnyPrompt =
      (workspace.scenePrompts && workspace.scenePrompts.some((p) => p?.trim())) ||
      fallbackPrompt;

    if (!hasAnyPrompt) return;

    const initialImages: ChapterImage[] = Array.from({ length: count }, (_, i) => ({
      index: i,
      label: `장면 ${i + 1}`,
      imageUrl: null,
      status: "pending",
    }));

    imagesRef.current = initialImages;
    warningShownRef.current = false;
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

      const promptText = getPromptForScene(i);

      try {
        const res = await fetch("/api/generate-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptText,
            apiKey: nanoBananaKey,
            options: nanoOptions,
            ...(characterImages?.length ? { characterImages } : {}),
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "이미지 생성 실패");

        if (data.warning && !warningShownRef.current) {
          warningShownRef.current = true;
          console.warn("[나노 바나나]", data.warning);
        }

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
  const isPromptGenerating = workspace.promptStatus === "generating";
  const hasScenePrompts = workspace.scenePrompts && workspace.scenePrompts.length > 0;
  const canGenerateImages =
    !isPromptGenerating &&
    (hasScenePrompts || !!(workspace.customPrompt || defaultImagePrompt).trim());

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
          <span className="text-base font-bold" style={{ color: workspace.color }}>
            챕터 {workspace.number}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
            {badge.label}
          </span>
          {isPromptGenerating && (
            <span className="flex items-center gap-1.5 text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
              <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              프롬프트 생성 중...
            </span>
          )}
          {workspace.promptStatus === "done" && hasScenePrompts && (
            <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              프롬프트 {workspace.scenePrompts!.length}개 준비됨
            </span>
          )}
          {workspace.promptStatus === "error" && (
            <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full" title={workspace.promptError}>
              프롬프트 생성 실패
            </span>
          )}
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
          <label className="block text-xs font-semibold text-gray-600 mb-1">대본 텍스트</label>
          <textarea
            value={workspace.scriptContent}
            onChange={(e) =>
              onUpdate((prev) => ({ ...prev, scriptContent: e.target.value }))
            }
            placeholder={`챕터 ${workspace.number}의 대본 텍스트를 붙여넣으세요...`}
            rows={14}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Image count */}
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">이미지 수</label>
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
          <span className="text-sm font-bold w-6 text-center" style={{ color: workspace.color }}>
            {Math.min(10, workspace.imageCount)}
          </span>
        </div>

        {/* 장면별 프롬프트 목록 */}
        {hasScenePrompts ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-600">
                장면별 이미지 프롬프트
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
            <div className="flex flex-col gap-2">
              {workspace.scenePrompts!.map((prompt, i) => (
                <div key={i} className="flex gap-2">
                  <span
                    className="text-xs font-bold pt-2 w-14 shrink-0 text-right"
                    style={{ color: workspace.color }}
                  >
                    장면 {i + 1}
                  </span>
                  <textarea
                    value={prompt}
                    onChange={(e) => {
                      const updated = [...workspace.scenePrompts!];
                      updated[i] = e.target.value;
                      onUpdate((prev) => ({ ...prev, scenePrompts: updated }));
                    }}
                    rows={3}
                    className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* 프롬프트 없을 때 — 단일 커스텀 프롬프트 */
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
              rows={10}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50"
              placeholder={defaultImagePrompt || "이미지 프롬프트를 입력하세요."}
            />
          </div>
        )}

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
            onImageClick={onImageLightbox}
          />
        )}
      </div>
    </div>
  );
}
