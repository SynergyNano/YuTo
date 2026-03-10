"use client";

import { useEffect, useState } from "react";
import type { ChapterWorkspace, SceneSelection } from "@/types";
import { CHAPTER_COLORS, parseChapters } from "@/lib/chapterParser";
import { DEFAULT_IMAGE_PROMPT } from "@/lib/promptRules";
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
  const DEFAULT_FULL_SCRIPT_PROMPT = "이 대본 전체를 읽고, 시각적으로 가장 중요한 핵심 장면들을 골라서 정리해 주세요.";
  const [fullScriptPrompt, setFullScriptPrompt] = useState(DEFAULT_FULL_SCRIPT_PROMPT);
  const [learnedScenes, setLearnedScenes] = useState<SceneSelection[]>([]);
  const [learnStatus, setLearnStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [learnMsg, setLearnMsg] = useState("");

  const learnedStoryContext = learnedScenes.length > 0
    ? learnedScenes.map(s =>
        `Scene ${s.number}: ${s.description}${s.excerpt ? ` (excerpt: "${s.excerpt.slice(0, 60)}...")` : ""}`
      ).join("\n")
    : "";

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

  async function handleLearnFullScript() {
    const script = fullScript;
    if (!script.trim()) {
      setLearnStatus("error");
      setLearnMsg("대본을 먼저 붙여넣어 주세요.");
      return;
    }
    setLearnStatus("testing");
    setLearnMsg("");
    try {
      const res = await fetch("/api/analyze-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          sceneCount: 12,
          claudeApiKey,
          customSystemPrompt: fullScriptPrompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "분석 실패");
      setLearnedScenes(data.scenes ?? []);
      setLearnStatus("ok");
      setLearnMsg(`${(data.scenes ?? []).length}개 장면 학습 완료`);
    } catch (err) {
      setLearnStatus("error");
      setLearnMsg(err instanceof Error ? err.message : String(err));
    }
  }

  // ── API 설정 (source of truth) ────────────────────────────────────────────
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [nanoBananaKey, setNanoBananaKey] = useState("");

  // ── 나노 바나나 이미지 설정 ───────────────────────────────────────────────
  const [nanoModelPref, setNanoModelPref] = useState<NanoModelPref>("best");
  const [nanoAspectRatio, setNanoAspectRatio] = useState<NanoAspectRatio>("16:9");
  const [nanoLongEdge, setNanoLongEdge] = useState(1536);
  const { width: nanoWidth, height: nanoHeight } = computeSize(nanoLongEdge, nanoAspectRatio);

  // ── Claude 모델 표시 ──────────────────────────────────────────────────────
  const [claudeModel, setClaudeModel] = useState("");
  useEffect(() => {
    fetch("/api/claude-model")
      .then((r) => r.json())
      .then((d) => setClaudeModel(d.model ?? ""))
      .catch(() => {});
  }, []);

  // ── 기본 이미지 프롬프트 ─────────────────────────────────────────────────
  const [defaultImagePrompt, setDefaultImagePrompt] = useState(DEFAULT_IMAGE_PROMPT);

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
      const savedLearnPrompt = window.localStorage.getItem("yuto_full_script_prompt");
      if (savedLearnPrompt) setFullScriptPrompt(savedLearnPrompt);
      const savedImagePrompt = window.localStorage.getItem("yuto_default_image_prompt");
      if (savedImagePrompt) setDefaultImagePrompt(savedImagePrompt);
    } catch { /* ignore */ }
  }, []);

  function handleSaveFullScriptPrompt() {
    try { localStorage.setItem("yuto_full_script_prompt", fullScriptPrompt); } catch { /* ignore */ }
  }

  function handleSaveDefaultImagePrompt() {
    try { localStorage.setItem("yuto_default_image_prompt", defaultImagePrompt); } catch { /* ignore */ }
  }

  return (
    <>
      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">대본 이미지 생성기</h1>
          <div className="flex items-center gap-2">
            {/* Claude 배지 */}
            <div className={`flex items-center rounded-full border text-xs font-medium overflow-hidden ${
              claudeApiKey ? "border-emerald-200" : "border-gray-200"
            }`}>
              <span className={`px-2.5 py-1 ${claudeApiKey ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-500"}`}>
                Claude
              </span>
              <span className={`px-2.5 py-1 ${claudeApiKey ? "bg-emerald-50 text-emerald-700" : "bg-white text-gray-400"}`}>
                {claudeApiKey
                  ? (claudeModel ? claudeModel.replace("claude-", "").replace(/-(\d)/, " $1") : "연결됨")
                  : "키 없음"}
              </span>
            </div>

            {/* 나노바나나 배지 */}
            <div className={`flex items-center rounded-full border text-xs font-medium overflow-hidden ${
              nanoBananaKey ? "border-violet-200" : "border-amber-200"
            }`}>
              <span className={`px-2.5 py-1 ${nanoBananaKey ? "bg-violet-500 text-white" : "bg-amber-100 text-amber-600"}`}>
                나노바나나
              </span>
              <span className={`px-2.5 py-1 ${nanoBananaKey ? "bg-violet-50 text-violet-700" : "bg-white text-amber-500"}`}>
                {nanoBananaKey ? nanoModelPref : "키 필요"}
              </span>
            </div>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 px-10 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
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
                placeholder=""
                rows={8}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {importError && (
                <p className="text-xs text-red-500">{importError}</p>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleImportScript}
                  disabled={!fullScript.trim()}
                  className="px-5 py-2 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition"
                >
                  챕터 파싱 후 카드 생성
                </button>
                <button
                  type="button"
                  onClick={handleLearnFullScript}
                  disabled={learnStatus === "testing"}
                  className="px-5 py-2 text-sm rounded-lg bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-40 transition flex items-center gap-2"
                >
                  {learnStatus === "testing" ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      학습 중...
                    </>
                  ) : (
                    "전체 대본 학습"
                  )}
                </button>
                {learnStatus === "ok" && (
                  <span className="text-xs text-emerald-600 font-medium">✓ {learnMsg}</span>
                )}
                {learnStatus === "error" && (
                  <span className="text-xs text-red-500">✕ {learnMsg}</span>
                )}
              </div>
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
              nanoBananaKey={nanoBananaKey}
              storyContext={learnedStoryContext}
              defaultImagePrompt={defaultImagePrompt}
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
        fullScriptPrompt={fullScriptPrompt}
        onFullScriptPromptChange={setFullScriptPrompt}
        defaultFullScriptPrompt={DEFAULT_FULL_SCRIPT_PROMPT}
        onSaveFullScriptPrompt={handleSaveFullScriptPrompt}
        defaultImagePrompt={defaultImagePrompt}
        onDefaultImagePromptChange={setDefaultImagePrompt}
        defaultDefaultImagePrompt={DEFAULT_IMAGE_PROMPT}
        onSaveDefaultImagePrompt={handleSaveDefaultImagePrompt}
        learnStatus={learnStatus}
      />
    </>
  );
}
