"use client";

import { useEffect, useRef, useState } from "react";

type NanoModelPref = "best" | "fast" | "v2";
type NanoAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
type TestStatus = "idle" | "testing" | "ok" | "error";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  claudeApiKey: string;
  onClaudeApiKeyChange: (key: string) => void;
  nanoBananaKey: string;
  onNanoBananaKeyChange: (key: string) => void;
  nanoModelPref: NanoModelPref;
  onNanoModelPrefChange: (v: NanoModelPref) => void;
  nanoAspectRatio: NanoAspectRatio;
  onNanoAspectRatioChange: (v: NanoAspectRatio) => void;
  nanoLongEdge: number;
  onNanoLongEdgeChange: (v: number) => void;
  nanoWidth: number;
  nanoHeight: number;
  fullScriptPrompt: string;
  onFullScriptPromptChange: (v: string) => void;
  defaultFullScriptPrompt: string;
  learnStatus: "idle" | "testing" | "ok" | "error";
  onSaveFullScriptPrompt: () => void;
  defaultImagePrompt: string;
  onDefaultImagePromptChange: (v: string) => void;
  defaultDefaultImagePrompt: string;
  onSaveDefaultImagePrompt: () => void;
}

export default function SettingsPanel({
  open,
  onClose,
  claudeApiKey,
  onClaudeApiKeyChange,
  nanoBananaKey,
  onNanoBananaKeyChange,
  nanoModelPref,
  onNanoModelPrefChange,
  nanoAspectRatio,
  onNanoAspectRatioChange,
  nanoLongEdge,
  onNanoLongEdgeChange,
  nanoWidth,
  nanoHeight,
  fullScriptPrompt,
  onFullScriptPromptChange,
  defaultFullScriptPrompt,
  learnStatus,
  onSaveFullScriptPrompt,
  defaultImagePrompt,
  onDefaultImagePromptChange,
  defaultDefaultImagePrompt,
  onSaveDefaultImagePrompt,
}: SettingsPanelProps) {
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [claudeTestStatus, setClaudeTestStatus] = useState<TestStatus>("idle");
  const [claudeTestMsg, setClaudeTestMsg] = useState("");

  const [showNanoKey, setShowNanoKey] = useState(false);
  const [nanoTestStatus, setNanoTestStatus] = useState<TestStatus>("idle");
  const [nanoTestMsg, setNanoTestMsg] = useState("");

  const [showLearnPrompt, setShowLearnPrompt] = useState(false);
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [learnPromptSaved, setLearnPromptSaved] = useState(false);
  const [imagePromptSaved, setImagePromptSaved] = useState(false);

  const [panelWidth, setPanelWidth] = useState(384); // 기본 w-96
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = panelWidth;

    function onMouseMove(ev: MouseEvent) {
      if (!isDragging.current) return;
      const delta = startX.current - ev.clientX;
      const newWidth = Math.min(800, Math.max(280, startWidth.current + delta));
      setPanelWidth(newWidth);
    }
    function onMouseUp() {
      isDragging.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

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

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <div
        style={{ width: panelWidth }}
        className={`fixed top-0 right-0 h-full bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* 드래그 핸들 */}
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-indigo-400 transition-colors group z-10"
          title="드래그하여 너비 조절"
        >
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-gray-300 rounded-full group-hover:bg-indigo-400 transition-colors" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900">설정</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none transition"
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-6">
          {/* ── Claude ── */}
          <section className="flex flex-col gap-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2">
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
                    onClaudeApiKeyChange(e.target.value);
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
                disabled={claudeTestStatus === "testing" || !claudeApiKey}
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
                  className="text-xs text-red-500 font-medium truncate max-w-[160px]"
                  title={claudeTestMsg}
                >
                  ✕ {claudeTestMsg}
                </span>
              )}
            </div>
          </section>

          {/* ── 나노 바나나 ── */}
          <section className="flex flex-col gap-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2">
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
                    onNanoBananaKeyChange(e.target.value);
                    setNanoTestStatus("idle");
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestNanoBanana}
                disabled={nanoTestStatus === "testing" || !nanoBananaKey}
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
                  className="text-xs text-red-500 font-medium block max-w-[320px] break-words whitespace-pre-wrap"
                  title={nanoTestMsg}
                >
                  ✕ {nanoTestMsg}
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                버전/모드
              </label>
              <select
                value={nanoModelPref}
                onChange={(e) => onNanoModelPrefChange(e.target.value as NanoModelPref)}
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
                onChange={(e) => onNanoAspectRatioChange(e.target.value as NanoAspectRatio)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="1:1">1:1 (정사각)</option>
                <option value="16:9">16:9 (가로)</option>
                <option value="9:16">9:16 (세로)</option>
                <option value="4:3">4:3</option>
                <option value="3:4">3:4</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                해상도 (긴 변 기준)
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={nanoLongEdge}
                  onChange={(e) => onNanoLongEdgeChange(Number(e.target.value))}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value={1536}>1536 (기본)</option>
                  <option value={2048}>2048 (고화질)</option>
                  <option value={2560}>2560 (최고화질)</option>
                </select>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  출력: {nanoWidth}×{nanoHeight}
                </span>
              </div>
            </div>
          </section>

          {/* ── 전체 대본 프롬프트 ── */}
          <section className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setShowLearnPrompt((v) => !v)}
              className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2 hover:text-gray-700 transition"
            >
              <span className="flex items-center gap-2">
                전체 대본 프롬프트
                {fullScriptPrompt !== defaultFullScriptPrompt && (
                  <span className="text-xs font-normal normal-case text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    수정됨
                  </span>
                )}
                {learnStatus === "ok" && (
                  <span className="text-xs font-normal normal-case text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                    학습됨
                  </span>
                )}
              </span>
              <span className="text-gray-400">{showLearnPrompt ? "▲" : "▼"}</span>
            </button>
            {showLearnPrompt && (
              <>
                <p className="text-xs text-gray-500">
                  이 프롬프트를 기준으로 Claude가 전체 대본을 한 번 학습합니다.
                </p>
                <textarea
                  value={fullScriptPrompt}
                  onChange={(e) => onFullScriptPromptChange(e.target.value)}
                  rows={4}
                  className="w-full p-3 border border-gray-300 rounded-lg text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
                  placeholder="어떻게 학습할지 Claude에게 지시하세요..."
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      onSaveFullScriptPrompt();
                      setLearnPromptSaved(true);
                      setTimeout(() => setLearnPromptSaved(false), 2000);
                    }}
                    className="px-4 py-1.5 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition"
                  >
                    저장
                  </button>
                  {learnPromptSaved && (
                    <span className="text-xs text-emerald-600 font-medium">✓ 저장됨</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onFullScriptPromptChange(defaultFullScriptPrompt)}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    기본값으로 초기화
                  </button>
                </div>
              </>
            )}
          </section>

          {/* ── 기본 이미지 프롬프트 ── */}
          <section className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setShowImagePrompt((v) => !v)}
              className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2 hover:text-gray-700 transition"
            >
              <span className="flex items-center gap-2">
                기본 이미지 프롬프트
                {defaultImagePrompt !== defaultDefaultImagePrompt && (
                  <span className="text-xs font-normal normal-case text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    수정됨
                  </span>
                )}
              </span>
              <span className="text-gray-400">{showImagePrompt ? "▲" : "▼"}</span>
            </button>
            {showImagePrompt && (
              <>
                <p className="text-xs text-gray-500">
                  각 챕터 카드의 이미지 프롬프트 기본값입니다. 카드에서 직접 수정하면 해당 카드만 변경됩니다.
                </p>
                <textarea
                  value={defaultImagePrompt}
                  onChange={(e) => onDefaultImagePromptChange(e.target.value)}
                  rows={5}
                  className="w-full p-3 border border-gray-300 rounded-lg text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
                  placeholder="모든 챕터 카드에 기본으로 들어갈 이미지 프롬프트..."
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      onSaveDefaultImagePrompt();
                      setImagePromptSaved(true);
                      setTimeout(() => setImagePromptSaved(false), 2000);
                    }}
                    className="px-4 py-1.5 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition"
                  >
                    저장
                  </button>
                  {imagePromptSaved && (
                    <span className="text-xs text-emerald-600 font-medium">✓ 저장됨</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onDefaultImagePromptChange(defaultDefaultImagePrompt)}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    기본값으로 초기화
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
