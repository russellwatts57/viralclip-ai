import { NextResponse } from "next/server";
import {
  fetchTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptVideoUnavailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
} from "youtube-transcript";

type TranscriptSegment = {
  text: string;
  duration: number;
  offset: number;
  lang?: string;
};

type Clip = {
  start: string;
  end: string;
  viralScore: number;
  title: string;
  reason: string;
  caption: string;
};

const YOUTUBE_ID_PATTERN = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/))([A-Za-z0-9_-]{11})/;

function parseVideoId(url: string) {
  const match = url.match(YOUTUBE_ID_PATTERN);
  return match?.[1] ?? null;
}

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

  addMatches(/\b(?:why|how|what|when|who|where|did|do|does|is|are|can|could|would|should)\b/g, 6);
  addMatches(/\b(?:surpris(?:e|ing)|shocking|unexpected|twist|reveals?|revealed|can'?t believe|won'?t believe|don'?t miss|wait until|must see|you have to see)\b/g, 8);
  addMatches(/\b(?:amazed|amazing|emotional|heartbreaking|crazy|wild|intense|powerful|funny|insane|beautiful|terrifying|scary|dramatic)\b/g, 6);
  addMatches(/\b(?:final(?:ly|e)?|ends with|ends up|result|payoff|worth it|winning|won|lost|revealed)\b/g, 7);
  addMatches(/\d+/g, 5);

  if (/[!?]/.test(lower)) {
    score += 4;
  }

  if (durationSeconds >= 18 && durationSeconds <= 30) {
    score += 8;
  }

  if (durationSeconds > 35) {
    score -= 8;
  }

  if (durationSeconds < 15) {
    score -= 10;
  }

  if (lower.length > 280) {
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
    return "Don’t miss the moment at the end 👀";
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
  if (/surpris(?:e|ing)|unexpected|shocking|twist|reveals?|revealed/.test(lower)) {
    reasons.push("includes surprise and payoff language");
  }
  if (/\d+/.test(lower)) {
    reasons.push("uses concrete numbers that stand out");
  }
  if (/amazed|emotional|heartbreaking|intense|powerful|funny|dramatic/.test(lower)) {
    reasons.push("leans into emotion and clear impact");
  }

  if (reasons.length === 0) {
    return "This clip has a clear standalone message with strong short-form potential.";
  }

  return `This clip ${reasons.join(" and ")}.`;
}

function buildClipWindows(transcript: TranscriptSegment[]) {
  const windows: Array<{ start: number; end: number; text: string; score: number }> = [];

  for (let i = 0; i < transcript.length; i += 1) {
    const start = transcript[i].offset;
    let text = "";
    let end = start;

    for (let j = i; j < transcript.length; j += 1) {
      const segment = transcript[j];
      end = segment.offset + segment.duration;
      const duration = end - start;
      text = `${text ? `${text} ` : ""}${segment.text}`;

      if (duration >= 15 && duration <= 35) {
        windows.push({
          start,
          end,
          text: text.trim(),
          score: scoreTranscriptWindow(text, duration),
        });
      }

      if (duration > 35) {
        break;
      }
    }
  }

  return windows;
}

async function fetchYoutubeMetadata(videoId: string) {
  const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

  try {
    const response = await fetch(oEmbedUrl);
    if (!response.ok) {
      throw new Error("Metadata fetch failed");
    }

    const data = await response.json();
    return {
      title: data.title ?? `YouTube video ${videoId}`,
      channelName: data.author_name ?? "Unknown channel",
      thumbnailUrl:
        data.thumbnail_url ?? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch {
    return {
      title: `YouTube video ${videoId}`,
      channelName: "Unknown channel",
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (!url) {
    return NextResponse.json(
      { error: "Missing YouTube URL" },
      { status: 400 }
    );
  }

  const videoId = parseVideoId(url);
  if (!videoId) {
    return NextResponse.json(
      { error: "Invalid YouTube URL" },
      { status: 400 }
    );
  }

  const metadata = await fetchYoutubeMetadata(videoId);

  let transcript: TranscriptSegment[] = [];
  try {
    transcript = await fetchTranscript(videoId);
  } catch (error) {
    if (
      error instanceof YoutubeTranscriptDisabledError ||
      error instanceof YoutubeTranscriptNotAvailableError ||
      error instanceof YoutubeTranscriptVideoUnavailableError ||
      error instanceof YoutubeTranscriptNotAvailableLanguageError ||
      error instanceof YoutubeTranscriptTooManyRequestError
    ) {
      return NextResponse.json({
        title: metadata.title,
        channelName: metadata.channelName,
        thumbnailUrl: metadata.thumbnailUrl,
        clips: [],
        transcriptUnavailable:
          "No captions or transcript were available for this video.",
      });
    }

    return NextResponse.json(
      {
        title: metadata.title,
        channelName: metadata.channelName,
        thumbnailUrl: metadata.thumbnailUrl,
        clips: [],
        transcriptUnavailable:
          "The transcript could not be retrieved. Please try a different video.",
      },
      { status: 500 }
    );
  }

  if (!transcript.length) {
    return NextResponse.json({
      title: metadata.title,
      channelName: metadata.channelName,
      thumbnailUrl: metadata.thumbnailUrl,
      clips: [],
      transcriptUnavailable:
        "No captions or transcript were available for this video.",
    });
  }

  const windows = buildClipWindows(transcript)
    .sort((a, b) => b.score - a.score)
    .filter((window, index, windowsArray) => {
      return (
        index ===
        windowsArray.findIndex(
          (existing) =>
            Math.abs(existing.start - window.start) < 8 &&
            Math.abs(existing.end - window.end) < 8
        )
      );
    })
    .slice(0, 20);

  const selected: Array<{ start: number; end: number; text: string; score: number }> = [];
  const chosen: Clip[] = [];

  for (const window of windows) {
    if (
      selected.some(
        (existing) =>
          Math.abs(existing.start - window.start) < 10 &&
          Math.abs(existing.end - window.end) < 10
      )
    ) {
      continue;
    }

    selected.push(window);
    chosen.push({
      start: formatTimestamp(window.start),
      end: formatTimestamp(window.end),
      viralScore: window.score,
      title: suggestTitle(window.text),
      reason: explainReason(window.text),
      caption: generateCaption(window.text),
    });

    if (chosen.length >= 5) {
      break;
    }
  }

  if (!chosen.length) {
    return NextResponse.json({
      title: metadata.title,
      channelName: metadata.channelName,
      thumbnailUrl: metadata.thumbnailUrl,
      clips: [],
      transcriptUnavailable:
        "The transcript was too short to provide clip suggestions.",
    });
  }

  return NextResponse.json({
    title: metadata.title,
    channelName: metadata.channelName,
    thumbnailUrl: metadata.thumbnailUrl,
    clips: chosen,
  });
}
