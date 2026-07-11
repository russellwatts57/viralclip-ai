import { NextResponse } from "next/server";
import { transcribeVideo } from "@/lib/transcription";
import { analyzeTranscript } from "@/lib/analysis";
import { DevDiagnostics } from "@/lib/types";

const isDev = process.env.NODE_ENV === "development";

export async function POST(request: Request) {
  const startTime = Date.now();
  const diagnostics: DevDiagnostics = {
    routeStatus: "success",
    transcript: { source: "upload", status: "success" },
    totalDurationMs: 0,
  };

  try {
    if (!process.env.OPENAI_API_KEY) {
      diagnostics.routeStatus = "error";
      diagnostics.failureCode = "MISSING_OPENAI_KEY";
      console.error("[Upload Route] OPENAI_API_KEY not configured");
      return NextResponse.json(
        {
          error: "Transcription service is not configured. Please contact support.",
          ...(isDev && { diagnostics }),
        },
        { status: 500 }
      );
    }

    const { blobUrl, fileName } = await request.json().catch(() => ({}));

    if (!blobUrl || !fileName) {
      diagnostics.routeStatus = "error";
      diagnostics.failureCode = "MISSING_BLOB_OR_FILENAME";
      return NextResponse.json(
        {
          error: "Missing blob URL or file name",
          ...(isDev && { diagnostics }),
        },
        { status: 400 }
      );
    }

    const blobResponse = await fetch(blobUrl);
    if (!blobResponse.ok) {
      diagnostics.routeStatus = "error";
      diagnostics.failureCode = "BLOB_DOWNLOAD_FAILED";
      console.error(
        `[Upload Route] Failed to download blob: ${blobResponse.status}`
      );
      return NextResponse.json(
        {
          error: "Failed to retrieve uploaded video",
          ...(isDev && { diagnostics }),
        },
        { status: 500 }
      );
    }

    const fileBuffer = await blobResponse.arrayBuffer();
    if (fileBuffer.byteLength === 0) {
      diagnostics.routeStatus = "error";
      diagnostics.failureCode = "EMPTY_FILE";
      return NextResponse.json(
        {
          error: "Uploaded file is empty",
          ...(isDev && { diagnostics }),
        },
        { status: 400 }
      );
    }

    const transcriptStartTime = Date.now();
    let transcript;
    try {
      transcript = await transcribeVideo(Buffer.from(fileBuffer), fileName);
    } catch (error) {
      diagnostics.routeStatus = "error";
      diagnostics.failureCode = "TRANSCRIPTION_FAILED";
      diagnostics.transcript.status = "error";
      diagnostics.transcript.errorCode = "TRANSCRIPTION_FAILED";
      diagnostics.transcript.errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error(
        "[Upload Route] Transcription failed:",
        error instanceof Error ? error.message : String(error)
      );

      return NextResponse.json({
        error: "Failed to transcribe video. Please try another file.",
        ...(isDev && { diagnostics }),
      });
    }

    diagnostics.transcript.transcriptLength = transcript.length;

    if (!transcript.length) {
      diagnostics.transcript.status = "error";
      diagnostics.transcript.errorCode = "TRANSCRIPT_EMPTY";
      return NextResponse.json({
        error: "Transcription resulted in no text. Please try another file.",
        ...(isDev && { diagnostics }),
      });
    }

    const analysisStartTime = Date.now();
    const clips = analyzeTranscript(transcript);
    diagnostics.analysis = {
      windowsGenerated: transcript.length,
      clipsSelected: clips.length,
      scoringDurationMs: Date.now() - analysisStartTime,
    };

    if (!clips.length) {
      diagnostics.transcript.errorCode = "NO_VIABLE_CLIPS";
      return NextResponse.json({
        error: "No viable clips found in the transcription. Please try a longer or different video.",
        ...(isDev && { diagnostics }),
      });
    }

    diagnostics.totalDurationMs = Date.now() - startTime;
    return NextResponse.json({
      clips,
      transcriptLength: transcript.length,
      ...(isDev && { diagnostics }),
    });
  } catch (error) {
    diagnostics.routeStatus = "error";
    diagnostics.failureCode = "UNKNOWN_ERROR";

    console.error(
      "[Upload Route] Unexpected error:",
      error instanceof Error ? error.message : String(error)
    );

    diagnostics.totalDurationMs = Date.now() - startTime;
    return NextResponse.json(
      {
        error: "An unexpected error occurred. Please try again.",
        ...(isDev && { diagnostics }),
      },
      { status: 500 }
    );
  }
}
