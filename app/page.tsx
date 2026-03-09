"use client";

import { useEffect, useState } from "react";
import type { ChapterWorkspace, SceneSelection } from "@/types";
import { CHAPTER_COLORS, parseChapters } from "@/lib/chapterParser";
import { SYSTEM_PROMPT } from "@/lib/promptRules";
import ChapterCard from "@/components/ChapterCard";

type ClaudeTestStatus = "idle" | "testing" | "ok" | "error";
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
    prompts: [],
    images: [],
    promptStatus: "idle",
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
      // Renumber sequentially after deletion
      return filtered.map((w, i) => ({
        ...w,
        number: i + 1,
        color: CHAPTER_COLORS[i % CHAPTER_COLORS.length],
      }));
    });
  }

  // ── 나노 바나나 연결 테스트 ──────────────────────────────────────────────
  async function handleTestNanoBanana() {
    setNanoTestStatus("testing");
    setNanoTestMsg("");
    try {
      const res = await fetch("/api/test-nano-banana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: nanoBananaKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNanoTestStatus("ok");
      setNanoTestMsg(`연결 성공 (HTTP ${data.status})`);
    } catch (err) {
      setNanoTestStatus("error");
      setNanoTestMsg(err instanceof Error ? err.message : "연결 실패");
    }
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
      prompts: [],
      images: [],
      promptStatus: "idle",
      imageStatus: "idle",
    }));
    setWorkspaces(newWorkspaces);
    setFullScript("");
    setShowImport(false);
    setLearnedScenes([]);
    setLearnStatus("idle");
    setLearnMsg("");
  }

  // ── API 설정 ─────────────────────────────────────────────────────────────
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [claudeTestStatus, setClaudeTestStatus] =
    useState<ClaudeTestStatus>("idle");
  const [claudeTestMsg, setClaudeTestMsg] = useState("");

  const [nanoBananaKey, setNanoBananaKey] = useState("");
  const [showNanoKey, setShowNanoKey] = useState(false);
  const [nanoTestStatus, setNanoTestStatus] = useState<ClaudeTestStatus>("idle");
  const [nanoTestMsg, setNanoTestMsg] = useState("");
  const [showApiSettings, setShowApiSettings] = useState(true);

  // ── 나노 바나나 이미지 설정 ───────────────────────────────────────────────
  const [nanoModelPref, setNanoModelPref] = useState<NanoModelPref>("best");
  const [nanoAspectRatio, setNanoAspectRatio] =
    useState<NanoAspectRatio>("1:1");
  const [nanoLongEdge, setNanoLongEdge] = useState(1024);
  const { width: nanoWidth, height: nanoHeight } = computeSize(
    nanoLongEdge,
    nanoAspectRatio
  );

  // ── 프롬프트 규칙 ────────────────────────────────────────────────────────
  const [customSystemPrompt, setCustomSystemPrompt] = useState(SYSTEM_PROMPT);
  const [showPromptSettings, setShowPromptSettings] = useState(false);

  // ── 전체 대본 학습 결과 ────────────────────────────────────────────────────
  const [learnedScenes, setLearnedScenes] = useState<SceneSelection[]>([]);
  const [learnStatus, setLearnStatus] =
    useState<ClaudeTestStatus>("idle");
  const [learnMsg, setLearnMsg] = useState("");

  const learnedStoryContext =
    learnedScenes.length > 0
      ? learnedScenes
          .map(
            (s) =>
              `Scene ${s.number}: ${s.description}${
                s.excerpt ? ` (excerpt: "${s.excerpt.slice(0, 60)}...")` : ""
              }`
          )
          .join("\n")
      : "";

  // ── 로컬 스토리지에서 키 복원 ─────────────────────────────────────────────
  useEffect(() => {
    try {
      const savedClaude = window.localStorage.getItem("yuto_claude_api_key");
      if (savedClaude) {
        setClaudeApiKey(savedClaude);
      }
      const savedNano = window.localStorage.getItem("yuto_nano_api_key");
      if (savedNano) {
        setNanoBananaKey(savedNano);
      }
    } catch {
      // localStorage 사용 불가한 환경은 조용히 무시
    }
  }, []);

  // ── 전체 대본 학습 (한 번) ────────────────────────────────────────────────
  async function handleLearnFullScript() {
    const script = workspaces
      .map((w) => w.scriptContent)
      .join("\n\n")
      .trim();
    if (!script) {
      setLearnStatus("error");
      setLearnMsg("학습할 대본이 없습니다. 먼저 챕터를 생성해주세요.");
      return;
    }

    setLearnStatus("testing");
    setLearnMsg("");
    try {
      const res = await fetch("/api/analyze-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, sceneCount: 12 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const scenes: SceneSelection[] = data.scenes ?? [];
      setLearnedScenes(scenes);
      setLearnStatus("ok");
      setLearnMsg(`대본 학습 완료 (핵심 장면 ${scenes.length}개 분석)`);
    } catch (err) {
      setLearnStatus("error");
      setLearnMsg(
        err instanceof Error ? err.message : "대본 학습에 실패했습니다."
      );
    }
  }

  // ── Claude 연결 테스트 ───────────────────────────────────────────────────
  async function handleTestClaude() {
    setClaudeTestStatus("testing");
    setClaudeTestMsg("");
    try {
      const res = await fetch("/api/test-claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: claudeApiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClaudeTestStatus("ok");
      setClaudeTestMsg(`연결 성공 (${data.model})`);
    } catch (err) {
      setClaudeTestStatus("error");
      setClaudeTestMsg(err instanceof Error ? err.message : "연결 실패");
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          대본 이미지 생성기
        </h1>
        <p className="text-sm text-gray-500">
          챕터별로 대본을 입력하고 AI 이미지를 독립적으로 생성합니다.
        </p>
      </div>

      {/* ── 전체 대본 가져오기 ────────────────────────────────────────────── */}
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleImportScript}
                disabled={!fullScript.trim()}
                className="px-5 py-2 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition"
              >
                챕터 파싱 후 카드 생성
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLearnFullScript}
                  disabled={learnStatus === "testing"}
                  className="px-4 py-2 text-xs rounded-lg bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-40 transition flex items-center gap-2"
                >
                  {learnStatus === "testing" ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      대본 학습 중...
                    </>
                  ) : (
                    "전체 대본 학습"
                  )}
                </button>
                {learnStatus === "ok" && (
                  <span className="text-[11px] text-emerald-600 font-medium">
                    ✓ {learnMsg}
                  </span>
                )}
                {learnStatus === "error" && (
                  <span
                    className="text-[11px] text-red-500 font-medium max-w-[200px] truncate"
                    title={learnMsg}
                  >
                    ✕ {learnMsg}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 설정 패널 ─────────────────────────────────────────────────────── */}
      <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* API 설정 */}
        <button
          type="button"
          onClick={() => setShowApiSettings((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
        >
          <span className="flex items-center gap-2">
            API 설정
            <span
              className={`text-xs font-normal px-2 py-0.5 rounded-full ${
                claudeApiKey
                  ? "text-emerald-600 bg-emerald-50"
                  : "text-amber-600 bg-amber-50"
              }`}
            >
              Claude {claudeApiKey ? "키 입력됨" : "키 필요"}
            </span>
            <span
              className={`text-xs font-normal px-2 py-0.5 rounded-full ${
                nanoBananaKey
                  ? "text-emerald-600 bg-emerald-50"
                  : "text-amber-600 bg-amber-50"
              }`}
            >
              나노바나나 {nanoBananaKey ? "키 입력됨" : "키 필요"}
            </span>
          </span>
          <span className="text-gray-400">{showApiSettings ? "▲" : "▼"}</span>
        </button>

        {showApiSettings && (
          <div className="border-t border-gray-100 px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Claude */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Claude (Anthropic)
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  API 키
                </label>
                <div className="flex gap-2">
                  <input
                    type={showClaudeKey ? "text" : "password"}
                    value={claudeApiKey}
                    onChange={(e) => {
                      const value = e.target.value;
                      setClaudeApiKey(value);
                      try {
                        if (value) {
                          window.localStorage.setItem("yuto_claude_api_key", value);
                        } else {
                          window.localStorage.removeItem("yuto_claude_api_key");
                        }
                      } catch {
                        // ignore storage errors
                      }
                      setClaudeTestStatus("idle");
                    }}
                    placeholder="sk-ant-..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClaudeKey((v) => !v)}
                    className="px-2 text-xs border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50"
                  >
                    {showClaudeKey ? "숨기기" : "보기"}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestClaude}
                  disabled={claudeTestStatus === "testing"}
                  className="px-4 py-1.5 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition flex items-center gap-2"
                >
                  {claudeTestStatus === "testing" ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      테스트 중...
                    </>
                  ) : (
                    "연결 테스트"
                  )}
                </button>
                {claudeTestStatus === "ok" && (
                  <span className="text-xs text-emerald-600 font-medium">
                    ✓ {claudeTestMsg}
                  </span>
                )}
                {claudeTestStatus === "error" && (
                  <span
                    className="text-xs text-red-500 font-medium max-w-[240px] sm:max-w-[320px] md:max-w-[420px] lg:max-w-[520px] overflow-x-auto whitespace-nowrap"
                    title={claudeTestMsg}
                  >
                    ✕ {claudeTestMsg}
                  </span>
                )}
              </div>
            </div>

            {/* 나노 바나나 */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                나노 바나나
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  API 키
                </label>
                <div className="flex gap-2">
                  <input
                    type={showNanoKey ? "text" : "password"}
                    value={nanoBananaKey}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNanoBananaKey(value);
                      try {
                        if (value) {
                          window.localStorage.setItem("yuto_nano_api_key", value);
                        } else {
                          window.localStorage.removeItem("yuto_nano_api_key");
                        }
                      } catch {
                        // ignore storage errors
                      }
                    }}
                    placeholder="나노 바나나 API 키"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNanoKey((v) => !v)}
                    className="px-2 text-xs border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50"
                  >
                    {showNanoKey ? "숨기기" : "보기"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    버전/모드
                  </label>
                  <select
                    value={nanoModelPref}
                    onChange={(e) => setNanoModelPref(e.target.value as NanoModelPref)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="best">최신/최선 (품질 우선)</option>
                    <option value="fast">Fast (속도 우선)</option>
                    <option value="v2">v2 (구버전/안정)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    비율
                  </label>
                  <select
                    value={nanoAspectRatio}
                    onChange={(e) =>
                      setNanoAspectRatio(e.target.value as NanoAspectRatio)
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="1:1">1:1 (정사각)</option>
                    <option value="16:9">16:9 (가로)</option>
                    <option value="9:16">9:16 (세로)</option>
                    <option value="4:3">4:3</option>
                    <option value="3:4">3:4</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    해상도 (긴 변 기준)
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={nanoLongEdge}
                      onChange={(e) => setNanoLongEdge(Number(e.target.value))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value={768}>768</option>
                      <option value={1024}>1024</option>
                      <option value={1536}>1536</option>
                    </select>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      출력: {nanoWidth}×{nanoHeight}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestNanoBanana}
                  disabled={nanoTestStatus === "testing"}
                  className="px-4 py-1.5 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition flex items-center gap-2"
                >
                  {nanoTestStatus === "testing" ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      테스트 중...
                    </>
                  ) : (
                    "연결 테스트"
                  )}
                </button>
                {nanoTestStatus === "ok" && (
                  <span className="text-xs text-emerald-600 font-medium">
                    ✓ {nanoTestMsg}
                  </span>
                )}
                {nanoTestStatus === "error" && (
                  <span
                    className="text-xs text-red-500 font-medium max-w-[240px] sm:max-w-[320px] md:max-w-[420px] lg:max-w-[520px] overflow-x-auto whitespace-nowrap"
                    title={nanoTestMsg}
                  >
                    ✕ {nanoTestMsg}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 프롬프트 규칙 설정 */}
        <button
          type="button"
          onClick={() => setShowPromptSettings((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition"
        >
          <span className="flex items-center gap-2">
            프롬프트 규칙 설정
            {customSystemPrompt !== SYSTEM_PROMPT && (
              <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                수정됨
              </span>
            )}
          </span>
          <span className="text-gray-400">{showPromptSettings ? "▲" : "▼"}</span>
        </button>

        {showPromptSettings && (
          <div className="border-t border-gray-100 px-5 py-4">
            <p className="text-xs text-gray-500 mb-2">
              Claude에게 전달하는 이미지 프롬프트 생성 지침입니다. 직접 수정할 수 있습니다.
            </p>
            <textarea
              value={customSystemPrompt}
              onChange={(e) => setCustomSystemPrompt(e.target.value)}
              className="w-full h-64 p-3 border border-gray-300 rounded-lg text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
            />
            <button
              type="button"
              onClick={() => setCustomSystemPrompt(SYSTEM_PROMPT)}
              className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline"
            >
              기본값으로 초기화
            </button>
          </div>
        )}
      </div>

      {/* ── 챕터 카드 목록 ──────────────────────────────────────────────────── */}
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
            storyContext={learnedStoryContext}
          />
        ))}

        {/* + 챕터 추가 */}
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
  );
}
