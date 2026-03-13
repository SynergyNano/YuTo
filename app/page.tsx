"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import type { CharacterProfile, ChapterWorkspace, SceneSelection } from "@/types";
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
  const { data: session } = useSession();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ── Workspaces (챕터 파싱 후 카드 생성 시에만 생성됨) ─────────────────────
  const [workspaces, setWorkspaces] = useState<ChapterWorkspace[]>([]);

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
  const [showImport, setShowImport] = useState(true); // 처음엔 전체 대본만 보이도록 펼침 유지
  const [importError, setImportError] = useState("");
  const DEFAULT_FULL_SCRIPT_PROMPT = "전체 대본을 읽고, 어떤 내용인지 상세하게 학습해줘";
  const [fullScriptPrompt, setFullScriptPrompt] = useState(DEFAULT_FULL_SCRIPT_PROMPT);
  const [learnedScenes, setLearnedScenes] = useState<SceneSelection[]>([]);
  const [learnStatus, setLearnStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [learnMsg, setLearnMsg] = useState("");
  const [showLearnResult, setShowLearnResult] = useState(false);

  // ── 등장인물 추출 ─────────────────────────────────────────────────────────
  const [extractedCharacters, setExtractedCharacters] = useState<CharacterProfile[]>([]);
  const [selectedCharacterNames, setSelectedCharacterNames] = useState<Set<string>>(new Set());
  const [characterStatus, setCharacterStatus] = useState<"idle" | "extracting" | "done" | "error">("idle");
  const [characterMsg, setCharacterMsg] = useState("");

  const selectedCharacters = extractedCharacters.filter((c) =>
    selectedCharacterNames.has(c.name)
  );

  const characterImages = selectedCharacters
    .filter((c) => c.referenceImageUrl)
    .map((c) => c.referenceImageUrl!)
    .slice(0, 4);

  async function handleExtractCharacters() {
    if (!fullScript.trim()) {
      setCharacterStatus("error");
      setCharacterMsg("대본을 먼저 붙여넣어 주세요.");
      return;
    }
    setCharacterStatus("extracting");
    setCharacterMsg("");
    try {
      const res = await fetch("/api/extract-characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: fullScript, claudeApiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "추출 실패");
      const chars: CharacterProfile[] = data.characters ?? [];
      setExtractedCharacters(chars);
      setSelectedCharacterNames(new Set());
      setCharacterStatus("done");
      setCharacterMsg(`${chars.length}명 추출 완료`);
    } catch (err) {
      setCharacterStatus("error");
      setCharacterMsg(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleGenerateCharacterImage(name: string) {
    const char = extractedCharacters.find((c) => c.name === name);
    if (!char) return;
    if (!nanoBananaKey.trim()) {
      alert("나노 바나나 API 키를 먼저 입력해주세요. (우측 ⚙ 설정)");
      return;
    }

    setExtractedCharacters((prev) =>
      prev.map((c) => c.name === name ? { ...c, imageStatus: "generating" } : c)
    );

    const prompt =
      `Full body portrait of ${char.description}, standing in neutral front-facing pose, ` +
      `white background, reference sheet style, high quality photography, ` +
      `detailed face and clothing visible, full figure from head to toe.`;

    try {
      const res = await fetch("/api/generate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          apiKey: nanoBananaKey,
          options: { aspectRatio: "1:1" },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "이미지 생성 실패");

      const imageUrl =
        data.imageUrl ??
        (data.base64 ? `data:image/png;base64,${data.base64}` : null);

      setExtractedCharacters((prev) =>
        prev.map((c) =>
          c.name === name
            ? { ...c, imageStatus: "done", referenceImageUrl: imageUrl ?? undefined }
            : c
        )
      );
    } catch (err) {
      setExtractedCharacters((prev) =>
        prev.map((c) => c.name === name ? { ...c, imageStatus: "error" } : c)
      );
      console.error("캐릭터 이미지 생성 실패:", err);
    }
  }

  async function handleGenerateAllCharacterImages() {
    const toGenerate = extractedCharacters.filter(
      (c) => selectedCharacterNames.has(c.name) && c.imageStatus !== "generating"
    );
    for (const char of toGenerate) {
      await handleGenerateCharacterImage(char.name);
    }
  }

  function toggleCharacter(name: string) {
    setSelectedCharacterNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        if (next.size >= 4) return prev; // 최대 4명 제한
        next.add(name);
      }
      return next;
    });
  }

  function selectAllCharacters() {
    const top4 = extractedCharacters.slice(0, 4).map((c) => c.name);
    setSelectedCharacterNames(new Set(top4));
  }

  function deselectAllCharacters() {
    setSelectedCharacterNames(new Set());
  }

  const learnedStoryContext = learnedScenes.length > 0
    ? learnedScenes.map(s =>
        `Scene ${s.number}: ${s.description}${s.excerpt ? ` (excerpt: "${s.excerpt.slice(0, 60)}...")` : ""}`
      ).join("\n")
    : "";

  async function handleImportScript() {
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
      scenePrompts: [],
      promptStatus: claudeApiKey.trim() ? "generating" as const : "idle" as const,
      images: [],
      imageStatus: "idle" as const,
    }));

    setWorkspaces(newWorkspaces);
    setFullScript("");
    setShowImport(false);

    if (!claudeApiKey.trim()) return;

    // 각 챕터별 프롬프트 자동 생성
    for (const ws of newWorkspaces) {
      try {
        const res = await fetch("/api/generate-prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chapterNumber: ws.number,
            chapterContent: ws.scriptContent,
            sceneCount: ws.imageCount,
            claudeApiKey,
            customSystemPrompt: defaultImagePrompt,
            storyContext: learnedStoryContext,
            characters: selectedCharacters.length > 0 ? selectedCharacters : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "프롬프트 생성 실패");

        const prompts: string[] = (data.prompts as { prompt: string }[]).map((p) => p.prompt);
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === ws.id ? { ...w, scenePrompts: prompts, promptStatus: "done" } : w
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.id === ws.id ? { ...w, promptStatus: "error", promptError: message } : w
          )
        );
      }
    }
  }

  async function handleAnalyzeScript() {
    const script = fullScript;
    if (!script.trim()) {
      setLearnStatus("error");
      setLearnMsg("대본을 먼저 붙여넣어 주세요.");
      return;
    }
    setLearnStatus("testing");
    setLearnMsg("");
    setCharacterStatus("extracting");
    setCharacterMsg("");
    setShowLearnResult(false);

    try {
      const [sceneRes, charRes] = await Promise.all([
        fetch("/api/analyze-script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script,
            sceneCount: 12,
            claudeApiKey,
            customSystemPrompt: fullScriptPrompt,
          }),
        }),
        fetch("/api/extract-characters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script, claudeApiKey }),
        }),
      ]);

      const sceneData = await sceneRes.json();
      if (!sceneRes.ok) throw new Error(sceneData.error ?? "줄거리 분석 실패");
      const scenes = sceneData.scenes ?? [];
      setLearnedScenes(scenes);
      setLearnStatus("ok");
      setLearnMsg(`줄거리 ${scenes.length}개 장면 학습 완료`);
      setShowLearnResult(true);

      const charData = await charRes.json();
      if (!charRes.ok) throw new Error(charData.error ?? "등장인물 추출 실패");
      const chars: CharacterProfile[] = charData.characters ?? [];
      setExtractedCharacters(chars);
      setSelectedCharacterNames(new Set());
      setCharacterStatus("done");
      setCharacterMsg(`${chars.length}명 추출 완료`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLearnStatus("error");
      setLearnMsg(msg);
      setCharacterStatus("error");
      setCharacterMsg(msg);
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
          <h1 className="text-lg font-bold text-gray-900">유토피아</h1>
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
            {session?.user && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 hidden sm:block">
                  {session.user.email}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                >
                  로그아웃
                </button>
              </div>
            )}
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
                  onClick={handleAnalyzeScript}
                  disabled={learnStatus === "testing" || !fullScript.trim()}
                  className="px-5 py-2 text-sm rounded-lg bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-40 transition flex items-center gap-2"
                >
                  {learnStatus === "testing" ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      분석 중...
                    </>
                  ) : (
                    "전체 대본 분석"
                  )}
                </button>
                {learnStatus === "ok" && (
                  <button
                    type="button"
                    onClick={() => setShowLearnResult((v) => !v)}
                    className="text-xs text-violet-600 font-medium hover:text-violet-800 underline"
                  >
                    ✓ {learnMsg}
                    {extractedCharacters.length > 0 && ` · 등장인물 ${extractedCharacters.length}명`}
                    {" "}{showLearnResult ? "▲ 숨기기" : "▼ 결과 보기"}
                  </button>
                )}
                {learnStatus === "error" && (
                  <span className="text-xs text-red-500">✕ {learnMsg}</span>
                )}
              </div>

              {/* 학습 결과 */}
              {showLearnResult && learnedScenes.length > 0 && (
                <div className="border border-violet-200 rounded-lg bg-violet-50 overflow-hidden">
                  <div className="px-3 py-2 bg-violet-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-violet-700">
                      학습된 장면 {learnedScenes.length}개
                    </span>
                    <span className="text-xs text-violet-400">챕터 프롬프트 생성 시 맥락으로 활용됩니다</span>
                  </div>
                  <div className="divide-y divide-violet-100">
                    {learnedScenes.map((scene) => (
                      <div key={scene.number} className="px-3 py-2.5 flex gap-3">
                        <span className="text-xs font-bold text-violet-400 shrink-0 mt-0.5">
                          #{scene.number}
                        </span>
                        <div className="flex flex-col gap-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700">{scene.description}</p>
                          {scene.excerpt && (
                            <p className="text-xs text-gray-400 italic truncate">
                              "{scene.excerpt.slice(0, 80)}{scene.excerpt.length > 80 ? "…" : ""}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 등장인물 목록 */}
              {extractedCharacters.length > 0 && (
                <div className="mt-1 border border-emerald-200 rounded-lg p-3 bg-emerald-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-emerald-700">
                      등장인물 {extractedCharacters.length}명 추출됨 — {selectedCharacterNames.size}/4명 선택
                      {selectedCharacterNames.size >= 4 && (
                        <span className="ml-1.5 text-amber-600 font-medium">(최대 4명)</span>
                      )}
                    </span>
                    <div className="flex gap-2 items-center">
                      <button
                        type="button"
                        onClick={handleGenerateAllCharacterImages}
                        disabled={!nanoBananaKey.trim() || selectedCharacterNames.size === 0}
                        className="text-xs px-2 py-0.5 rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 transition"
                      >
                        전체 이미지 생성
                      </button>
                      <button
                        type="button"
                        onClick={selectAllCharacters}
                        className="text-xs text-emerald-600 hover:text-emerald-800 underline"
                      >
                        전체 선택
                      </button>
                      <span className="text-xs text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={deselectAllCharacters}
                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        전체 해제
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {extractedCharacters.map((c) => (
                      <div key={c.name} className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedCharacterNames.has(c.name)}
                          onChange={() => toggleCharacter(c.name)}
                          className="mt-1 accent-emerald-500 shrink-0"
                        />
                        {/* Thumbnail */}
                        <div className="shrink-0 w-14 h-14 rounded border border-emerald-200 bg-emerald-50 overflow-hidden flex items-center justify-center">
                          {c.imageStatus === "generating" ? (
                            <span className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                          ) : c.referenceImageUrl ? (
                            <img
                              src={c.referenceImageUrl}
                              alt={c.name}
                              className="w-full h-full object-cover cursor-zoom-in"
                              onClick={() => setLightboxUrl(c.referenceImageUrl!)}
                            />
                          ) : (
                            <span className="text-lg text-emerald-300">👤</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-gray-800">{c.name}</span>
                            {c.isMandatory && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold leading-none">
                                ⭐ 필수
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 line-clamp-2">{c.description}</span>
                          <button
                            type="button"
                            onClick={() => handleGenerateCharacterImage(c.name)}
                            disabled={c.imageStatus === "generating" || !nanoBananaKey.trim()}
                            className="mt-0.5 self-start text-xs px-2 py-0.5 rounded border border-emerald-300 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 transition"
                          >
                            {c.imageStatus === "generating"
                              ? "생성 중..."
                              : c.imageStatus === "done"
                              ? "재생성"
                              : "이미지 생성"}
                          </button>
                          {c.imageStatus === "error" && (
                            <span className="text-xs text-red-500">생성 실패</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 챕터 카드 목록 (챕터 파싱 후 카드 생성 시에만 표시) ───────────── */}
        <div className="flex flex-col gap-4">
          {workspaces.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
              <p className="text-sm text-gray-500">
                전체 대본을 입력한 뒤 <strong className="text-gray-700">챕터 파싱 후 카드 생성</strong> 버튼을 누르면
                <br />
                챕터별 카드가 여기에 생성됩니다.
              </p>
            </div>
          ) : (
            <>
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
                  characterImages={characterImages.length > 0 ? characterImages : undefined}
                  onImageLightbox={setLightboxUrl}
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
            </>
          )}
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

      {/* 캐릭터 이미지 라이트박스 */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="캐릭터 레퍼런스"
            className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white text-3xl leading-none hover:text-gray-300 transition"
            onClick={() => setLightboxUrl(null)}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
