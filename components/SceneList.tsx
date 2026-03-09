"use client";

import { useState } from "react";
import type { SceneSelection } from "@/types";

interface SceneListProps {
  scenes: SceneSelection[];
  activeScene: number | null;
  onSceneClick: (number: number) => void;
  onUpdatePrompt: (sceneNumber: number, prompt: string) => void;
  onGenerateImages: () => void;
  isGenerating: boolean;
  nanoBananaKeyMissing: boolean;
}

export default function SceneList({
  scenes,
  activeScene,
  onSceneClick,
  onUpdatePrompt,
  onGenerateImages,
  isGenerating,
  nanoBananaKeyMissing,
}: SceneListProps) {
  const [editingNumber, setEditingNumber] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  function startEdit(scene: SceneSelection) {
    setEditingNumber(scene.number);
    setEditValue(scene.prompt);
  }

  function saveEdit(sceneNumber: number) {
    onUpdatePrompt(sceneNumber, editValue);
    setEditingNumber(null);
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          장면을 클릭하면 대본에서 위치를 확인할 수 있습니다.
        </p>
      </div>

      <div className="flex flex-col gap-2 flex-1 overflow-y-auto max-h-[460px] pr-0.5">
        {scenes.map((scene) => {
          const isActive = activeScene === scene.number;
          const isEditing = editingNumber === scene.number;

          return (
            <div
              key={scene.number}
              className={`rounded-lg border transition-all ${
                isActive ? "shadow-md" : "shadow-none"
              }`}
              style={{
                borderColor: isActive ? scene.color : "#e5e7eb",
                backgroundColor: isActive ? scene.color + "08" : "#fff",
              }}
            >
              {/* Header */}
              <button
                type="button"
                onClick={() => onSceneClick(scene.number)}
                className="w-full flex items-start gap-2 px-3 pt-3 pb-2 text-left"
              >
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: scene.color, color: "#fff" }}
                >
                  {scene.number}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-semibold truncate"
                    style={{ color: scene.color }}
                  >
                    장면 {scene.number}
                    {scene.startIndex < 0 && (
                      <span className="ml-1 font-normal text-amber-500">(위치 미확인)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                    {scene.description}
                  </p>
                </div>
              </button>

              {/* Prompt */}
              <div className="px-3 pb-3">
                {isEditing ? (
                  <div className="flex flex-col gap-1.5">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full text-xs font-mono border border-gray-300 rounded p-2 h-28 resize-y focus:outline-none focus:ring-2 focus:ring-blue-300"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(scene.number)}
                        className="text-xs px-2 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition"
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingNumber(null)}
                        className="text-xs px-2 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 transition"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                      {scene.prompt}
                    </p>
                    <button
                      type="button"
                      onClick={() => startEdit(scene)}
                      className="self-start text-xs text-blue-500 hover:underline"
                    >
                      편집
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onGenerateImages}
        disabled={isGenerating || scenes.length === 0 || nanoBananaKeyMissing}
        className="w-full py-3 rounded-lg bg-purple-500 text-white font-semibold hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm"
      >
        {isGenerating
          ? "이미지 생성 중..."
          : nanoBananaKeyMissing
          ? "API 키를 먼저 입력하세요"
          : `이미지 ${scenes.length}장 생성 시작 →`}
      </button>
    </div>
  );
}
