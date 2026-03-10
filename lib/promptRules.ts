export const DEFAULT_IMAGE_PROMPT = `★1. 이미지 프롬프트 구성 요소
각 챕터마다 **핵심 장면**에 대한 이미지 프롬프트를 생성한다.
1챕터와 2챕터와 3챕터는 10개의 핵심 장면에 대해 이미지 프롬프트를 생성한다
4챕터와 5챕터는 5개의 핵심 장면에 대해 이미지 프롬프트를 생성한다
6챕터에서 10챕터는 3개의 핵심 장면에 대해 이미지 프롬프트를 생성한다

2) 사용자가 "챕터1"이라고 입력하면 챕터 번호에 따라 다음 기준으로 핵심장면 수를 자동 생성한다:
- 챕터1 또는 챕터2 또는 챕터3 요청 시 → 10개의 핵심 장면
- 챕터4 또는 챕터5 요청 시 → 5개의 핵심 장면
- 챕터6~챕터10 요청 시 → 각 3개의 핵심 장면
⚠ 사용자가 챕터 번호만 입력하면 자동으로 장면 수를 판단하여 출력해야 한다.

RULE: 이미지 장면은 단순 핵심 장면이 아닌, '시간 흐름에 따라 균등히 분포된 감정 최고점 장면'으로 선정한다.
 - 장면들은 반드시 이야기 전개 흐름(초반 0~25%, 중반 25~50%, 후반 50~75%, 클라이맥스 75~100%)에서 각각 하나씩 뽑는다.
 - 각 구간에서 감정 강도가 가장 높은 순간을 선택하되, 시간 흐름 배분은 반드시 유지한다.
 - 감정 강도 기준은 눈물, 갈등, 충격, 깨달음, 후회, 기쁨, 분노 등의 감정 표현 변화로 판단한다.
 - 단, 모든 장면이 과잉 감정(예: 모두 울고있는 장면)으로만 구성되면 안 되며, 감정의 흐름이 점점 고조되는 형태여야 한다.`;

export const QUALITY_SUFFIX = `The scene is captured in ultra high-resolution photography style with crystal-clear sharpness and intense vibrant colors. Direct bright natural daylight floods the scene, creating strong highlights and deep contrast without any haze. The image has the look of a DSLR commercial photoshoot with a prime lens — tack sharp focus, glossy textures, and extreme clarity. The atmosphere is vivid, fresh, and hyper-realistic, with no filters, no softness, no muted tones — only bright, bold, and razor-sharp detail.`;

export const NIGHT_QUALITY_SUFFIX = `The scene is captured in ultra high-resolution photography style with crystal-clear sharpness and intense vibrant colors. Indoor lamp light and warm artificial lighting flood the scene, creating strong highlights and deep contrast without any haze. The image has the look of a DSLR commercial photoshoot with a prime lens — tack sharp focus, glossy textures, and extreme clarity. The atmosphere is vivid, fresh, and hyper-realistic, with no filters, no softness, no muted tones — only bright, bold, and razor-sharp detail.`;

export const FORBIDDEN_EXPRESSIONS = [
  "pale face",
  "ashen",
  "grey skin",
  "corpse-like",
  "red face",
  "reddened eyes",
  "wet eyelashes",
  "long eyelashes",
  "thick eyelashes",
  "swollen eyelids",
];

// ─── Script Analysis (new flow) ─────────────────────────────────────────────

export const ANALYSIS_SYSTEM_PROMPT = `You are an expert at analyzing Korean scripts/screenplays to select key visual scenes for image generation.

## Your Task
Read the entire script and select exactly N scenes that best represent the story visually.
For each selected scene, return:
1. The EXACT text excerpt from the script (copied character-for-character — this will be used to highlight the location in the original script)
2. A brief Korean description of the scene
3. A detailed English image generation prompt

## Scene Selection Rules
Distribute scenes evenly across the story's timeline:
- Early (0–25%): Setup, character introduction
- Mid-early (25–50%): Rising action, conflict begins
- Mid-late (50–75%): Complications, turning points
- Late/Climax (75–100%): Peak emotion, resolution

Gradually escalate emotional intensity — not all scenes should feel the same.

## Excerpt Rules
- Copy text EXACTLY as it appears in the script — do NOT paraphrase, translate, or modify
- Select 1–3 sentences that best describe the visual moment
- The excerpt must uniquely identify the location in the script

## Image Prompt Rules
- Write in English, 2–4 vivid descriptive sentences
- NEVER include: dialogue, speech text, exaggerated features, pale/ashen/grey skin, red face, reddened eyes, wet/long/thick eyelashes, swollen eyelids
- End every prompt with this quality suffix: "${QUALITY_SUFFIX}"

## Emotion Expression Guide
- Crying: tears glistening on cheeks, slightly trembling lips — NOT red face or swollen eyelids
- Anger: tense jaw, furrowed brows, clenched fists — NOT red face
- Joy: bright wide eyes, natural smile reaching eyes, relaxed open posture
- Sorrow: downcast eyes, slightly drooping shoulders, distant gaze

## Korean Home Scene Elements
Living room: wooden floors, white walls, simple furniture, family photos on wall
Kitchen: small Korean-style kitchen, rice cooker, kimchi fridge
Bedroom: single bed, study desk, textbooks
Outdoor: apartment complex courtyard, school gate, convenience store nearby

## Output Format
Output ONLY a valid JSON array — no markdown, no code fences, no extra text.
[
  {
    "number": 1,
    "excerpt": "exact text copied from the script",
    "description": "한국어로 장면 설명",
    "prompt": "English image generation prompt ending with quality suffix"
  },
  ...
]`;

export function buildAnalysisUserMessage(script: string, sceneCount: number): string {
  return `Select exactly ${sceneCount} key visual scenes from the following script.

## Script:
${script}

## Instructions:
- Select exactly ${sceneCount} scenes distributed across the story timeline
- For "excerpt": copy the text EXACTLY as written above — do not change a single character
- Output ONLY the JSON array, nothing else`;
}

// ─── Legacy (chapter-based flow kept for reference) ──────────────────────────

export const SYSTEM_PROMPT = `★1. 이미지 프롬프트 구성 요소
각 챕터마다 **핵심 장면**에 대한 이미지 프롬프트를 생성한다.
1챕터와 2챕터와 3챕터는 10개의 핵심 장면에 대해 이미지 프롬프트를 생성한다
4챕터와 5챕터는 5개의 핵심 장면에 대해 이미지 프롬프트를 생성한다
6챕터에서 10챕터는 3개의 핵심 장면에 대해 이미지 프롬프트를 생성한다

2) 사용자가 "챕터1"이라고 입력하면 챕터 번호에 따라 다음 기준으로 핵심장면 수를 자동 생성한다:
- 챕터1 또는 챕터2 또는 챕터3 요청 시 → 10개의 핵심 장면
- 챕터4 또는 챕터5 요청 시 → 5개의 핵심 장면
- 챕터6~챕터10 요청 시 → 각 3개의 핵심 장면
⚠ 사용자가 챕터 번호만 입력하면 자동으로 장면 수를 판단하여 출력해야 한다.

RULE: 이미지 장면은 단순 핵심 장면이 아닌, '시간 흐름에 따라 균등히 분포된 감정 최고점 장면'으로 선정한다.
 - 장면들은 반드시 이야기 전개 흐름(초반 0~25%, 중반 25~50%, 후반 50~75%, 클라이맥스 75~100%)에서 각각 하나씩 뽑는다.
 - 각 구간에서 감정 강도가 가장 높은 순간을 선택하되, 시간 흐름 배분은 반드시 유지한다.
 - 감정 강도 기준은 눈물, 갈등, 충격, 깨달음, 후회, 기쁨, 분노 등의 감정 표현 변화로 판단한다.
 - 단, 모든 장면이 과잉 감정(예: 모두 울고있는 장면)으로만 구성되면 안 되며, 감정의 흐름이 점점 고조되는 형태여야 한다.`;

export function buildUserMessage(
  chapterNumber: number,
  chapterContent: string,
  sceneCount: number,
  isNightScene = false,
  storyContext?: string
): string {
  const suffix = isNightScene ? NIGHT_QUALITY_SUFFIX : QUALITY_SUFFIX;
  const contextBlock = storyContext
    ? `## Learned Story Context (from full script):
${storyContext}

`
    : "";

  return `${contextBlock}## Chapter ${chapterNumber} Script Content:
${chapterContent}

## Instructions:
Generate exactly ${sceneCount} image prompts for this chapter.
Each prompt must end with this quality suffix:
"${suffix}"

Output only the ${sceneCount} prompts, one per line, no numbering.`;
}
