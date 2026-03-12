export interface Chapter {
  index: number;
  number: number;
  title: string;
  content: string;
  color: string;
  imageCount: number;
}

export interface ImagePrompt {
  chapterIndex: number;
  chapterNumber: number;
  sceneIndex: number;
  sceneNumber: number;
  label: string;
  prompt: string;
}

export interface GeneratedImage {
  chapterNumber: number;
  sceneNumber: number;
  label: string;
  imageUrl: string | null;
  status: "pending" | "generating" | "done" | "error";
  error?: string;
}

export interface SceneSelection {
  number: number;
  excerpt: string;
  description: string;
  prompt: string;
  color: string;
  startIndex: number;
  endIndex: number;
}

export interface CharacterProfile {
  name: string;
  description: string;
  isMandatory?: boolean; // 반드시 레퍼런스 이미지를 생성해야 하는 핵심 캐릭터 (최대 4명)
  referenceImageUrl?: string; // base64 data URL or http URL
  imageStatus?: "idle" | "generating" | "done" | "error";
}

export interface ChapterPrompt {
  index: number;
  label: string;
  prompt: string;
}

export interface ChapterImage {
  index: number;
  label: string;
  imageUrl: string | null;
  status: "pending" | "generating" | "done" | "error";
  error?: string;
}

export interface ChapterWorkspace {
  id: string;
  number: number;
  color: string;
  scriptContent: string;
  imageCount: number;
  customPrompt?: string;
  scenePrompts?: string[];
  promptStatus?: "idle" | "generating" | "done" | "error";
  promptError?: string;
  images: ChapterImage[];
  imageStatus: "idle" | "generating" | "done" | "error";
  imageError?: string;
}
