"use client";

import type { Chapter, GeneratedImage } from "@/types";

interface ImageGeneratorProps {
  chapters: Chapter[];
  images: GeneratedImage[];
  onImageClick?: (url: string) => void;
}

export default function ImageGenerator({ chapters, images, onImageClick }: ImageGeneratorProps) {
  const chapterMap = new Map(chapters.map((c) => [c.number, c]));

  const grouped = new Map<number, GeneratedImage[]>();
  for (const img of images) {
    if (!grouped.has(img.chapterNumber)) grouped.set(img.chapterNumber, []);
    grouped.get(img.chapterNumber)!.push(img);
  }

  function downloadImage(url: string, filename: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }

  function downloadAll() {
    images
      .filter((img) => img.imageUrl)
      .forEach((img, i) => {
        setTimeout(
          () =>
            downloadImage(
              img.imageUrl!,
              `chapter${img.chapterNumber}_scene${img.sceneNumber}.png`
            ),
          i * 200
        );
      });
  }

  const done = images.filter((i) => i.status === "done").length;
  const total = images.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">
          이미지 생성 결과
          <span className="ml-2 text-sm font-normal text-gray-500">
            {done}/{total}장 완료
          </span>
        </h2>
        {done > 0 && (
          <button
            type="button"
            onClick={downloadAll}
            className="px-4 py-1.5 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition"
          >
            전체 다운로드 ({done}장)
          </button>
        )}
      </div>

      {/* Overall progress */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>전체 진행</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="h-3 bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Per-chapter sections */}
      <div className="flex flex-col gap-8">
        {Array.from(grouped.entries()).map(([chapterNumber, chapterImages]) => {
          const chapter = chapterMap.get(chapterNumber);
          const chapterDone = chapterImages.filter((i) => i.status === "done").length;
          const chapterTotal = chapterImages.length;
          const chapterProgress =
            chapterTotal > 0 ? Math.round((chapterDone / chapterTotal) * 100) : 0;

          return (
            <div key={chapterNumber}>
              <div
                className="flex items-center justify-between mb-2 px-3 py-1.5 rounded"
                style={{
                  backgroundColor: (chapter?.color ?? "#888") + "18",
                  borderLeft: `4px solid ${chapter?.color ?? "#888"}`,
                }}
              >
                <span
                  className="font-semibold text-sm"
                  style={{ color: chapter?.color ?? "#888" }}
                >
                  {chapter?.title ?? `챕터 ${chapterNumber}`}
                </span>
                <span className="text-xs text-gray-500">
                  {chapterDone}/{chapterTotal}장
                </span>
              </div>

              <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3 overflow-hidden">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${chapterProgress}%`,
                    backgroundColor: chapter?.color ?? "#888",
                  }}
                />
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {chapterImages.map((img) => (
                  <div
                    key={img.label}
                    className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center group"
                  >
                    {img.status === "done" && img.imageUrl ? (
                      <>
                        <img
                          src={img.imageUrl}
                          alt={img.label}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => onImageClick?.(img.imageUrl!)}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2 p-2">
                          <p className="text-white text-[10px] font-bold text-center">
                            {img.label}
                          </p>
                          <div className="flex items-center gap-1.5">
                            {onImageClick && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onImageClick(img.imageUrl!);
                                }}
                                className="text-[11px] px-2 py-1 bg-white text-gray-800 rounded hover:bg-gray-100 transition"
                              >
                                확대
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadImage(
                                  img.imageUrl!,
                                  `chapter${img.chapterNumber}_scene${img.sceneNumber}.png`
                                );
                              }}
                              className="text-[11px] px-2 py-1 bg-white text-gray-800 rounded hover:bg-gray-100 transition"
                            >
                              다운로드
                            </button>
                          </div>
                        </div>
                      </>
                    ) : img.status === "generating" ? (
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className="w-6 h-6 border-2 border-transparent rounded-full animate-spin"
                          style={{ borderTopColor: chapter?.color ?? "#3B82F6" }}
                        />
                        <p className="text-[10px] text-gray-400">{img.label}</p>
                      </div>
                    ) : img.status === "error" ? (
                      <div className="flex flex-col items-center gap-1 p-2 text-center">
                        <span className="text-red-400 text-lg">✕</span>
                        <p className="text-[10px] text-red-500 leading-tight">
                          {img.error ?? "오류"}
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className="w-6 h-6 rounded-full border-2 opacity-25"
                          style={{ borderColor: chapter?.color ?? "#888" }}
                        />
                        <p className="text-[10px] text-gray-400">{img.label}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
