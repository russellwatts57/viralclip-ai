import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ["video/mp4", "video/quicktime", "video/webm"],
          maximumSizeInBytes: 500 * 1024 * 1024, // 500 MB
          tokenPayload: JSON.stringify({ userId: "user" }),
        };
      },
      onUploadCompleted: async () => {
        // Future: Update database with blob URL if needed
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    // Log detailed error server-side for debugging
    console.error("Blob upload error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Upload failed";

    // Provide helpful errors without exposing internal details to client
    let userMessage = "Upload failed";
    let statusCode = 400;

    if (errorMessage.includes("credentials") || errorMessage.includes("token")) {
      userMessage =
        "Upload service not configured. Please contact support.";
      statusCode = 503;
    } else if (errorMessage.includes("size")) {
      userMessage = "File is too large (max 500 MB)";
      statusCode = 400;
    } else if (errorMessage.includes("content")) {
      userMessage =
        "Invalid file type. Please upload MP4, MOV, or WebM.";
      statusCode = 400;
    }

    return NextResponse.json(
      { error: userMessage },
      { status: statusCode }
    );
  }
}
