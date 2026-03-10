"use client";

import { useEffect, useState } from "react";

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
  customSystemPrompt: string;
  onCustomSystemPromptChange: (v: string) => void;
  defaultSystemPrompt: string;
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
  customSystemPrompt,
  onCustomSystemPromptChange,
  defaultSystemPrompt,
}: SettingsPanelProps) {
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [claudeTestStatus, setClaudeTestStatus] = useState<TestStatus>("idle");
  const [claudeTestMsg, setClaudeTestMsg] = useState("");

  const [showNanoKey, setShowNanoKey] = useState(false);
  const [nanoTestStatus, setNanoTestStatus] = useState<TestStatus>("idle");
  const [nanoTestMsg, setNanoTestMsg] = useState("");

  const [showPromptRules, setShowPromptRules] = useState(false);

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
        className={`fixed top-0 right-0 h-full w-96 bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
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
                  className="text-xs text-red-500 font-medium truncate max-w-[160px]"
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
                  <option value={768}>768</option>
                  <option value={1024}>1024</option>
                  <option value={1536}>1536</option>
                </select>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  출력: {nanoWidth}×{nanoHeight}
                </span>
              </div>
            </div>
          </section>

          {/* ── 프롬프트 규칙 ── */}
          <section className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setShowPromptRules((v) => !v)}
              className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2 hover:text-gray-700 transition"
            >
              <span className="flex items-center gap-2">
                프롬프트 규칙
                {customSystemPrompt !== defaultSystemPrompt && (
                  <span className="text-xs font-normal normal-case text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    수정됨
                  </span>
                )}
              </span>
              <span className="text-gray-400">{showPromptRules ? "▲" : "▼"}</span>
            </button>
            {showPromptRules && (
              <>
                <p className="text-xs text-gray-500">
                  이미지 프롬프트 생성에 사용되는 시스템 지침입니다.
                </p>
                <textarea
                  value={customSystemPrompt}
                  onChange={(e) => onCustomSystemPromptChange(e.target.value)}
                  className="w-full h-48 p-3 border border-gray-300 rounded-lg text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
                />
                <button
                  type="button"
                  onClick={() => onCustomSystemPromptChange(defaultSystemPrompt)}
                  className="text-xs text-gray-400 hover:text-gray-600 underline self-start"
                >
                  기본값으로 초기화
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
