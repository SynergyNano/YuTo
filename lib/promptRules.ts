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

export const SYSTEM_PROMPT = `You are an expert at creating vivid, cinematic image prompts for AI image generation tools.

## Your Task
Given a chapter of a Korean script/screenplay, generate exactly N English image prompts that visually represent key scenes from that chapter.

## Scene Distribution Rule
Distribute scenes evenly across the chapter's timeline in 4 segments:
- Early (0-25%): Setup, introduction
- Mid-early (25-50%): Rising action
- Mid-late (50-75%): Complications, turning points
- Climax (75-100%): Peak emotional intensity

Gradually escalate emotional intensity across the scenes — not all scenes should feel the same.

## Emotion Expression Guide
- **Crying**: Tears glistening on cheeks, slightly trembling lips, glistening eyes — NOT red face, swollen eyelids, or thick eyelashes
- **Anger**: Tense jaw, furrowed brows, clenched fists, sharp posture — NOT red face or exaggerated expressions
- **Joy**: Bright wide eyes, natural smile reaching eyes, relaxed open posture
- **Sorrow**: Downcast eyes, slightly drooping shoulders, distant gaze, quiet stillness

## Mandatory Forbidden Elements
NEVER include in prompts:
- Dialogue or speech ("...", "he said", any text/words in the image)
- Exaggerated colors (neon, oversaturated)
- Exaggerated physical features (huge eyes, tiny waist)
- pale face, ashen skin, grey skin, corpse-like appearance
- red face, reddened eyes
- wet/long/thick eyelashes, swollen eyelids

## Output Format
Output ONLY the prompts, one per line, with no numbering, no extra commentary.
Each prompt should be 2-4 sentences of vivid English description.
Each prompt must end with the quality suffix provided.

Generate exactly the requested number of prompts.`;

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
