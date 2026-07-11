import { NextResponse } from "next/server";
import {
  fetchTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptVideoUnavailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
} from "youtube-transcript";
import { analyzeTranscript } from "@/lib/analysis";
import { DevDiagnostics } from "@/lib/types";

const YOUTUBE_ID_PATTERN =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/))([A-Za-z0-9_-]{11})/;
const isDev = process.env.NODE_ENV === "development";

function parseVideoId(url: string) {
  const match = url.match(YOUTUBE_ID_PATTERN);
  return match?.[1] ?? null;
}

function mapTranscriptError(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof YoutubeTranscriptDisabledError) {
    return {
      code: "CAPTIONS_DISABLED",
      message:
        "Captions are disabled for this video. Upload a video you own or have permission to process.",
    };
  }
  if (error instanceof YoutubeTranscriptNotAvailableError) {
    return {
      code: "CAPTIONS_UNAVAILABLE",
      message:
        "No captions available for this video. Upload a video you own or have permission to process.",
    };
  }
  if (error instanceof YoutubeTranscriptVideoUnavailableError) {
    return {
      code: "VIDEO_UNAVAILABLE",
      message: "This video is unavailable or private.",
    };
  }
  if (error instanceof YoutubeTranscriptNotAvailableLanguageError) {
    return {
      code: "CAPTIONS_UNAVAILABLE",
      message:
        "No captions available in any language for this video. Upload a video you own or have permission to process.",
    };
  }
  if (error instanceof YoutubeTranscriptTooManyRequestError) {
    return {
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again in a moment.",
    };
  }
  return {
    code: "TRANSCRIPT_ERROR",
    message: "Could not retrieve the transcript. Please try another video.",
  };
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
  const startTime = Date.now();
  const diagnostics: DevDiagnostics = {
    routeStatus: "success",
    transcript: { source: "youtube", status: "success" },
    totalDurationMs: 0,
  };

  try {
    const body = await request.json().catch(() => ({}));
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if (!url) {
      diagnostics.routeStatus = "error";
      diagnostics.failureCode = "MISSING_URL";
      return NextResponse.json(
        { error: "Missing YouTube URL" },
        { status: 400 }
      );
    }

    const videoId = parseVideoId(url);
    if (!videoId) {
      diagnostics.routeStatus = "error";
      diagnostics.failureCode = "INVALID_URL";
      diagnostics.transcript.status = "error";
      diagnostics.transcript.errorCode = "INVALID_URL";
      return NextResponse.json(
        {
          error: "Invalid YouTube URL",
          ...(isDev && { diagnostics }),
        },
        { status: 400 }
      );
    }

    const metadata = await fetchYoutubeMetadata(videoId);

    try {
      const transcript = await fetchTranscript(videoId);

      if (!transcript.length) {
        diagnostics.transcript.status = "error";
        diagnostics.transcript.errorCode = "TRANSCRIPT_EMPTY";
        diagnostics.transcript.errorMessage = "Transcript is empty";

        return NextResponse.json({
          title: metadata.title,
          channelName: metadata.channelName,
          thumbnailUrl: metadata.thumbnailUrl,
          clips: [],
          transcriptUnavailable:
            "No captions or transcript were available for this video. Upload a video you own or have permission to process.",
          ...(isDev && { diagnostics }),
        });
      }

      diagnostics.transcript.transcriptLength = transcript.length;
      const clips = analyzeTranscript(transcript);

      if (!clips.length) {
        diagnostics.transcript.errorCode = "NO_VIABLE_CLIPS";
        diagnostics.transcript.errorMessage = "Transcript too short for analysis";

        return NextResponse.json({
          title: metadata.title,
          channelName: metadata.channelName,
          thumbnailUrl: metadata.thumbnailUrl,
          clips: [],
          transcriptUnavailable:
            "The transcript was too short to provide clip suggestions.",
          ...(isDev && { diagnostics }),
        });
      }

      diagnostics.totalDurationMs = Date.now() - startTime;
      return NextResponse.json({
        title: metadata.title,
        channelName: metadata.channelName,
        thumbnailUrl: metadata.thumbnailUrl,
        clips,
        ...(isDev && { diagnostics }),
      });
    } catch (error) {
      const errorInfo = mapTranscriptError(error);
      diagnostics.routeStatus = "error";
      diagnostics.failureCode = errorInfo.code;
      diagnostics.transcript.status = "error";
      diagnostics.transcript.errorCode = errorInfo.code;
      diagnostics.transcript.errorMessage = String(error);

      console.error(
        `[YouTube Transcript Error] ${errorInfo.code}:`,
        error instanceof Error ? error.message : String(error)
      );

      return NextResponse.json({
        title: metadata.title,
        channelName: metadata.channelName,
        thumbnailUrl: metadata.thumbnailUrl,
        clips: [],
        transcriptUnavailable: errorInfo.message,
        ...(isDev && { diagnostics }),
      });
    }
  } catch (error) {
    diagnostics.routeStatus = "error";
    diagnostics.failureCode = "UNKNOWN_ERROR";

    console.error(
      "[YouTube Route Error]:",
      error instanceof Error ? error.message : String(error)
    );

    diagnostics.totalDurationMs = Date.now() - startTime;
    return NextResponse.json(
      {
        error: "An unexpected error occurred.",
        ...(isDev && { diagnostics }),
      },
      { status: 500 }
    );
  }
}
