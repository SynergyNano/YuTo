"use client";

import type { SceneSelection } from "@/types";

interface Segment {
  text: string;
  scene?: SceneSelection;
}

function buildSegments(script: string, scenes: SceneSelection[]): Segment[] {
  // Only use scenes with valid positions, sorted by start index
  const markers = scenes
    .filter((s) => s.startIndex >= 0)
    .sort((a, b) => a.startIndex - b.startIndex);

  const segments: Segment[] = [];
  let pos = 0;

  for (const scene of markers) {
    // Skip overlapping markers
    if (scene.startIndex < pos) continue;

    if (scene.startIndex > pos) {
      segments.push({ text: script.slice(pos, scene.startIndex) });
    }
    segments.push({
      text: script.slice(scene.startIndex, scene.endIndex),
      scene,
    });
    pos = scene.endIndex;
  }

  if (pos < script.length) {
    segments.push({ text: script.slice(pos) });
  }

  return segments;
}

interface ScriptHighlightProps {
  script: string;
  scenes: SceneSelection[];
  activeScene: number | null;
  onSceneClick: (number: number) => void;
}

export default function ScriptHighlight({
  script,
  scenes,
  activeScene,
  onSceneClick,
}: ScriptHighlightProps) {
  const segments = buildSegments(script, scenes);
  const notFound = scenes.filter((s) => s.startIndex < 0);

  return (
    <div className="flex flex-col gap-2">
      {notFound.length > 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
          {notFound.length}개 장면의 위치를 대본에서 찾지 못했습니다. (프롬프트는 생성됨)
        </p>
      )}

      <div className="max-h-[540px] overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 text-sm font-mono leading-relaxed whitespace-pre-wrap">
        {segments.map((seg, i) =>
          seg.scene ? (
            <button
              key={i}
              type="button"
              onClick={() => onSceneClick(seg.scene!.number)}
              title={`장면 ${seg.scene.number}: ${seg.scene.description}`}
              className="inline rounded transition-all cursor-pointer focus:outline-none"
              style={{
                backgroundColor:
                  activeScene === seg.scene.number
                    ? seg.scene.color + "55"
                    : seg.scene.color + "30",
                borderBottom: `2px solid ${seg.scene.color}`,
                outline:
                  activeScene === seg.scene.number
                    ? `2px solid ${seg.scene.color}`
                    : "none",
              }}
            >
              <span
                className="inline-flex items-center justify-center text-[10px] font-bold rounded-full w-4 h-4 mr-0.5 align-middle flex-shrink-0"
                style={{
                  backgroundColor: seg.scene.color,
                  color: "#fff",
                }}
              >
                {seg.scene.number}
              </span>
              {seg.text}
            </button>
          ) : (
            <span key={i} className="text-gray-700">
              {seg.text}
            </span>
          )
        )}
      </div>
    </div>
  );
}
