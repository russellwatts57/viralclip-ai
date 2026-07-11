import { TranscriptSegment } from "./types";

export async function transcribeVideo(
  fileBuffer: Buffer,
  fileName: string
): Promise<TranscriptSegment[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY not configured. Cannot transcribe video."
    );
  }

  // Dynamically import OpenAI to avoid build-time issues
  const OpenAI = (await import("openai")).default;
  const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const uint8Array = new Uint8Array(fileBuffer);
  const file = new File([uint8Array], fileName, {
    type: getMimeType(fileName),
  });

  try {
    const response = await openaiClient.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json",
    });

    if (!response.segments || !Array.isArray(response.segments)) {
      const fallbackSegment: TranscriptSegment = {
        text: response.text || "",
        offset: 0,
        duration: 0,
      };
      return [fallbackSegment];
    }

    return response.segments.map((segment: unknown) => {
      const seg = segment as { text?: unknown; start?: unknown; end?: unknown };
      return {
        text: String(seg.text || ""),
        offset: Number(seg.start || 0),
        duration: Number(Number(seg.end || seg.start) - Number(seg.start || 0)),
      };
    });
  } catch (error) {
    const OpenAIModule = await import("openai");
    if (error instanceof OpenAIModule.APIError) {
      throw new Error(
        `OpenAI transcription failed: ${error.message} (${error.status})`
      );
    }
    throw error;
  }
}

function getMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop();
  switch (ext) {
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    default:
      return "video/mp4";
  }
}
