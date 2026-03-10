"use client";

import { useEffect, useState } from "react";
import type { ChapterWorkspace } from "@/types";
import { CHAPTER_COLORS, parseChapters } from "@/lib/chapterParser";
import { SYSTEM_PROMPT } from "@/lib/promptRules";
import ChapterCard from "@/components/ChapterCard";
import SettingsPanel from "@/components/SettingsPanel";

type NanoModelPref = "best" | "fast" | "v2";
type NanoAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

function roundTo64(n: number) {
  return Math.max(64, Math.round(n / 64) * 64);
}

function computeSize(longEdge: number, aspect: NanoAspectRatio) {
  const [wR, hR] = aspect.split(":").map((v) => Number(v));
  if (!wR || !hR) return { width: longEdge, height: longEdge };
  if (wR === hR) return { width: roundTo64(longEdge), height: roundTo64(longEdge) };

  if (wR > hR) {
    const width = roundTo64(longEdge);
    const height = roundTo64((longEdge * hR) / wR);
    return { width, height };
  }

  const height = roundTo64(longEdge);
  const width = roundTo64((longEdge * wR) / hR);
  return { width, height };
}

function createWorkspace(index: number): ChapterWorkspace {
  return {
    id: crypto.randomUUID(),
    number: index + 1,
    color: CHAPTER_COLORS[index % CHAPTER_COLORS.length],
    scriptContent: "",
    imageCount: 10,
    customPrompt: "",
    images: [],
    imageStatus: "idle",
  };
}

export default function Home() {
  // ── Workspaces ───────────────────────────────────────────────────────────
  const [workspaces, setWorkspaces] = useState<ChapterWorkspace[]>([
    createWorkspace(0),
  ]);

  function addWorkspace() {
    setWorkspaces((prev) => [...prev, createWorkspace(prev.length)]);
  }

  function updateWorkspace(
    id: string,
    updater: (prev: ChapterWorkspace) => ChapterWorkspace
  ) {
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === id ? updater(w) : w))
    );
  }

  function deleteWorkspace(id: string) {
    setWorkspaces((prev) => {
      const filtered = prev.filter((w) => w.id !== id);
      return filtered.map((w, i) => ({
        ...w,
        number: i + 1,
        color: CHAPTER_COLORS[i % CHAPTER_COLORS.length],
      }));
    });
  }

  // ── 전체 대본 가져오기 ───────────────────────────────────────────────────
  const [fullScript, setFullScript] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importError, setImportError] = useState("");

  function handleImportScript() {
    const parsed = parseChapters(fullScript);
    if (parsed.length === 0) {
      setImportError(
        "챕터를 감지하지 못했습니다. 챕터 구분 형식을 확인하세요. (예: 챕터 1, Chapter 1, 제1장)"
      );
      return;
    }
    setImportError("");

    const newWorkspaces: ChapterWorkspace[] = parsed.map((chapter, i) => ({
      id: crypto.randomUUID(),
      number: chapter.number,
      color: CHAPTER_COLORS[i % CHAPTER_COLORS.length],
      scriptContent: chapter.content,
      imageCount: chapter.imageCount,
      customPrompt: "",
      images: [],
      imageStatus: "idle",
    }));

    setWorkspaces(newWorkspaces);
    setFullScript("");
    setShowImport(false);
  }

  // ── API 설정 (source of truth) ────────────────────────────────────────────
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [nanoBananaKey, setNanoBananaKey] = useState("");

  // ── 나노 바나나 이미지 설정 ───────────────────────────────────────────────
  const [nanoModelPref, setNanoModelPref] = useState<NanoModelPref>("best");
  const [nanoAspectRatio, setNanoAspectRatio] = useState<NanoAspectRatio>("1:1");
  const [nanoLongEdge, setNanoLongEdge] = useState(1024);
  const { width: nanoWidth, height: nanoHeight } = computeSize(nanoLongEdge, nanoAspectRatio);

  // ── 프롬프트 규칙 ────────────────────────────────────────────────────────
  const [customSystemPrompt, setCustomSystemPrompt] = useState(SYSTEM_PROMPT);

  // ── 설정 패널 ────────────────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── API 키 변경 핸들러 (localStorage 포함) ───────────────────────────────
  function handleClaudeApiKeyChange(value: string) {
    setClaudeApiKey(value);
    try {
      if (value) localStorage.setItem("yuto_claude_api_key", value);
      else localStorage.removeItem("yuto_claude_api_key");
    } catch { /* ignore */ }
  }

  function handleNanoBananaKeyChange(value: string) {
    setNanoBananaKey(value);
    try {
      if (value) localStorage.setItem("yuto_nano_api_key", value);
      else localStorage.removeItem("yuto_nano_api_key");
    } catch { /* ignore */ }
  }

  // ── 로컬 스토리지에서 키 복원 ─────────────────────────────────────────────
  useEffect(() => {
    try {
      const savedClaude = window.localStorage.getItem("yuto_claude_api_key");
      if (savedClaude) setClaudeApiKey(savedClaude);
      const savedNano = window.localStorage.getItem("yuto_nano_api_key");
      if (savedNano) setNanoBananaKey(savedNano);
    } catch { /* ignore */ }
  }, []);

  return (
    <>
      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">대본 이미지 생성기</h1>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              claudeApiKey ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"
            }`}>
              Claude {claudeApiKey ? "연결됨" : "키 없음"}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              nanoBananaKey ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
            }`}>
              나노바나나 {nanoBananaKey ? "연결됨" : "키 필요"}
            </span>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
            >
              ⚙ 설정
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* ── 전체 대본 가져오기 ──────────────────────────────────────────── */}
        <div className="mb-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => { setShowImport((v) => !v); setImportError(""); }}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            <span>전체 대본 가져오기</span>
            <span className="text-gray-400">{showImport ? "▲" : "▼"}</span>
          </button>

          {showImport && (
            <div className="border-t border-gray-100 px-5 py-4 flex flex-col gap-3">
              <p className="text-xs text-gray-500">
                전체 대본을 붙여넣으면 챕터를 자동으로 파싱해서 카드를 생성합니다.
                <span className="text-amber-600 font-medium"> 기존 카드는 모두 교체됩니다.</span>
              </p>
              <textarea
                value={fullScript}
                onChange={(e) => setFullScript(e.target.value)}
                placeholder={"챕터 1\n...\n\n챕터 2\n...\n\n챕터 3\n..."}
                rows={8}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {importError && (
                <p className="text-xs text-red-500">{importError}</p>
              )}
              <button
                type="button"
                onClick={handleImportScript}
                disabled={!fullScript.trim()}
                className="self-start px-5 py-2 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition"
              >
                챕터 파싱 후 카드 생성
              </button>
            </div>
          )}
        </div>

        {/* ── 챕터 카드 목록 ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {workspaces.map((ws) => (
            <ChapterCard
              key={ws.id}
              workspace={ws}
              onUpdate={(updater) => updateWorkspace(ws.id, updater)}
              onDelete={() => deleteWorkspace(ws.id)}
              claudeApiKey={claudeApiKey}
              customSystemPrompt={customSystemPrompt}
              nanoBananaKey={nanoBananaKey}
              nanoOptions={{
                modelPref: nanoModelPref,
                aspectRatio: nanoAspectRatio,
                width: nanoWidth,
                height: nanoHeight,
              }}
            />
          ))}

          <button
            type="button"
            onClick={addWorkspace}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 text-sm font-medium hover:border-blue-400 hover:text-blue-500 transition"
          >
            <span className="text-lg leading-none">+</span>
            챕터 추가
          </button>
        </div>
      </main>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        claudeApiKey={claudeApiKey}
        onClaudeApiKeyChange={handleClaudeApiKeyChange}
        nanoBananaKey={nanoBananaKey}
        onNanoBananaKeyChange={handleNanoBananaKeyChange}
        nanoModelPref={nanoModelPref}
        onNanoModelPrefChange={setNanoModelPref}
        nanoAspectRatio={nanoAspectRatio}
        onNanoAspectRatioChange={setNanoAspectRatio}
        nanoLongEdge={nanoLongEdge}
        onNanoLongEdgeChange={setNanoLongEdge}
        nanoWidth={nanoWidth}
        nanoHeight={nanoHeight}
        customSystemPrompt={customSystemPrompt}
        onCustomSystemPromptChange={setCustomSystemPrompt}
        defaultSystemPrompt={SYSTEM_PROMPT}
      />
    </>
  );
}
