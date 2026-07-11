import { Clip, TranscriptSegment } from "./types";

function formatTimestamp(seconds: number) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function scoreTranscriptWindow(text: string, durationSeconds: number) {
  const lower = text.toLowerCase();
  let score = 25;

  const addMatches = (pattern: RegExp, weight: number) => {
    const matches = lower.match(pattern)?.length ?? 0;
    score += matches * weight;
  };

  addMatches(
    /\b(?:why|how|what|when|who|where|did|do|does|is|are|can|could|would|should)\b/g,
    6
  );
  addMatches(
    /\b(?:surpris(?:e|ing)|shocking|unexpected|twist|reveals?|revealed|can'?t believe|won'?t believe|don'?t miss|wait until|must see|you have to see)\b/g,
    8
  );
  addMatches(
    /\b(?:amazed|amazing|emotional|heartbreaking|crazy|wild|intense|powerful|funny|insane|beautiful|terrifying|scary|dramatic)\b/g,
    6
  );
  addMatches(
    /\b(?:final(?:ly|e)?|ends with|ends up|result|payoff|worth it|winning|won|lost|revealed)\b/g,
    7
  );
  addMatches(/\d+/g, 5);

  if (/[!?]/.test(lower)) {
    score += 4;
  }

  if (durationSeconds >= 18 && durationSeconds <= 45) {
    score += 8;
  } else if (durationSeconds < 15 || durationSeconds > 45) {
    score -= 5;
  }

  if (lower.length > 300) {
    score -= 6;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function suggestTitle(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const sentenceMatch = normalized.match(/(.+?[.!?])\s/);
  const titleCandidate = sentenceMatch?.[1] ?? normalized;
  const cleanTitle = titleCandidate.replace(/\s+/g, " ").trim();

  if (cleanTitle.length <= 72) {
    return cleanTitle;
  }

  return `${cleanTitle.slice(0, 69).trim()}...`;
}

function generateCaption(text: string) {
  const lower = text.toLowerCase();
  if (/you won'?t believe|can'?t believe/.test(lower)) {
    return "You won't believe what happens here 😳";
  }
  if (/don'?t miss|must see|wait until/.test(lower)) {
    return "Don't miss the moment at the end 👀";
  }
  if (/\b(?:why|how|what|when|who|where)\b/.test(lower)) {
    return "This question keeps you watching until the payoff...";
  }
  if (/\d+/.test(lower)) {
    return "The numbers in this clip make it impossible to scroll past.";
  }
  return "The payoff here makes this a strong short-form moment.";
}

function explainReason(text: string) {
  const lower = text.toLowerCase();
  const reasons: string[] = [];

  if (/\b(?:why|how|what|when|who|where)\b/.test(lower)) {
    reasons.push("sparks curiosity with a strong question");
  }
  if (
    /surpris(?:e|ing)|unexpected|shocking|twist|reveals?|revealed/.test(lower)
  ) {
    reasons.push("includes surprise and payoff language");
  }
  if (/\d+/.test(lower)) {
    reasons.push("uses concrete numbers that stand out");
  }
  if (
    /amazed|emotional|heartbreaking|intense|powerful|funny|dramatic/.test(lower)
  ) {
    reasons.push("leans into emotion and clear impact");
  }

  if (reasons.length === 0) {
    return "This clip has a clear standalone message with strong short-form potential.";
  }

  return `This clip ${reasons.join(" and ")}.`;
}

export function analyzeTranscript(transcript: TranscriptSegment[]): Clip[] {
  const windows: Array<{
    start: number;
    end: number;
    text: string;
    score: number;
  }> = [];

  for (let i = 0; i < transcript.length; i += 1) {
    const start = transcript[i].offset;
    let text = "";
    let end = start;

    for (let j = i; j < transcript.length; j += 1) {
      const segment = transcript[j];
      end = segment.offset + segment.duration;
      const duration = end - start;
      text = `${text ? `${text} ` : ""}${segment.text}`;

      if (duration >= 15 && duration <= 45) {
        windows.push({
          start,
          end,
          text: text.trim(),
          score: scoreTranscriptWindow(text, duration),
        });
      }

      if (duration > 45) {
        break;
      }
    }
  }

  const sortedWindows = windows
    .sort((a, b) => b.score - a.score)
    .filter((window, index, windowsArray) => {
      return (
        index ===
        windowsArray.findIndex(
          (existing) =>
            Math.abs(existing.start - window.start) < 10 &&
            Math.abs(existing.end - window.end) < 10
        )
      );
    })
    .slice(0, 20);

  const selected: Array<{
    start: number;
    end: number;
    text: string;
    score: number;
  }> = [];
  const clips: Clip[] = [];

  for (const window of sortedWindows) {
    if (
      selected.some(
        (existing) =>
          Math.abs(existing.start - window.start) < 15 &&
          Math.abs(existing.end - window.end) < 15
      )
    ) {
      continue;
    }

    selected.push(window);
    clips.push({
      start: formatTimestamp(window.start),
      end: formatTimestamp(window.end),
      viralScore: window.score,
      title: suggestTitle(window.text),
      reason: explainReason(window.text),
      caption: generateCaption(window.text),
    });

    if (clips.length >= 5) {
      break;
    }
  }

  return clips;
}
