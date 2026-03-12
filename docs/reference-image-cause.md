# 레퍼런스 이미지가 반영되지 않는 원인 정리

## 현상
이미지 생성 시 **사용자가 만든 캐릭터 레퍼런스**가 아닌, 모델이 임의로 그린 캐릭터로 나옴.

---

## 원인

### 1. **Google API URL 사용 시 (주요 원인)**

설정에서 **NANO_BANANA_API_URL**이 `generativelanguage.googleapis.com` (Google Imagen)인 경우:

- `lib/nanoBananaClient.ts`에서 **Google 분기**로 들어가 `callGoogleGenerateImages()`를 호출합니다.
- 이 함수의 요청 body에는 **`prompt`**, **`imageGenerationConfig`**(이미지 수, 비율)만 들어가고,
- **`characterImages`(레퍼런스 이미지)는 전혀 포함되지 않습니다.**

즉, 프론트 → API 라우트 → `generateImage()`까지는 `characterImages`가 넘어오지만,  
Google로 실제 요청을 보낼 때 **레퍼런스 이미지 필드가 없어서** Google은 텍스트 프롬프트만 보고 생성합니다.  
그래서 “내가 만든 캐릭터”가 아니라 모델이 마음대로 그린 인물이 나옵니다.

- **코드 위치**: `lib/nanoBananaClient.ts`  
  - `callGoogleGenerateImages()` 내부의 `body` 객체 (86~105줄 근처)  
  - `options?.characterImages`를 사용하는 부분이 없음.

또한 Google Generative Language의 일반 `generateImages`/`predict` 스펙에는  
**레퍼런스 이미지를 넣는 표준 필드**가 없습니다.  
(캐릭터 일관성용 레퍼런스는 Vertex AI의 별도 모델 `imagen-3.0-capability-001` 등에서 지원)

---

### 2. **커스텀 나노 바나나 URL 사용 시**

설정에서 **NANO_BANANA_API_URL**이 Google이 아닌 **커스텀 백엔드**인 경우:

- `character_images`는 **body에 포함되어** 전달됩니다.  
  (`lib/nanoBananaClient.ts` 355~357줄: `character_images: options.characterImages.slice(0, 4)`)
- 따라서 **프론트/API 라우트는 레퍼런스 이미지를 올바르게 넘기고 있음.**

이 경우에도 캐릭터가 임의로 나온다면:

- **백엔드 서버**가 `character_images`(또는 동일한 의미의 필드)를 실제 생성 파이프라인에 사용하는지 확인해야 합니다.
- base64/data URL 형식, 배열 길이(최대 4개) 등 백엔드가 기대하는 형식과 일치하는지도 확인이 필요합니다.

---

## 데이터 흐름 요약

| 단계 | 동작 |
|------|------|
| 1. 프론트 | 선택된 캐릭터 중 `referenceImageUrl`이 있는 것만 모아 `characterImages` 배열로 만듦 (최대 4개) |
| 2. ChapterCard | 이미지 생성 시 `characterImages`를 body에 넣어 `/api/generate-images` 호출 |
| 3. API 라우트 | `body.characterImages`를 그대로 `generateImage(..., { characterImages })`에 전달 |
| 4. nanoBananaClient | **Google URL** → `callGoogleGenerateImages()` 호출 → **body에 characterImages 미포함** ❌ |
| 4. nanoBananaClient | **커스텀 URL** → `fetch(..., { character_images: options.characterImages })` ✅ |

---

## 권장 대응

1. **캐릭터 일관성이 중요할 때**
   - **레퍼런스 이미지를 지원하는 커스텀 나노 바나나 백엔드**를 사용하고,
   - 설정의 NANO_BANANA_API_URL을 그 백엔드 주소로 두는 것을 권장합니다.
   - 현재 코드는 커스텀 백엔드일 때 `character_images`를 이미 전달하고 있습니다.

2. **Google API만 사용할 때**
   - 현재 코드/스펙상 **일반 Imagen generateImages/predict에서는 레퍼런스 이미지를 보낼 수 없습니다.**
   - “내가 만든 캐릭터” 기준 일관성은 기대하기 어렵고, 프롬프트만으로 생성되는 형태로 사용해야 합니다.

3. **커스텀 백엔드를 쓰는데도 레퍼런스가 반영되지 않을 때**
   - 백엔드에서 `character_images`(또는 동일 필드)를 받아서 실제 생성 모델/API에 넘기는지 확인하고,
   - 필요하면 백엔드 쪽에서 해당 필드를 반드시 사용하도록 수정해야 합니다.
