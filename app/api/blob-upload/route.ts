import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    // Check for required credentials
    const hasOidcToken = process.env.VERCEL_OIDC_TOKEN;
    const hasBlobStoreId = process.env.BLOB_STORE_ID;
    const hasBlobToken = process.env.BLOB_READ_WRITE_TOKEN;

    // OIDC is preferred (automatic on Vercel), but fallback to token-based auth
    const hasCredentials = (hasOidcToken && hasBlobStoreId) || hasBlobToken;

    if (!hasCredentials) {
      console.error(
        "Blob upload credentials missing. For Vercel deployment, ensure BLOB_STORE_ID is set. " +
          "For local development, either run `vercel env pull` or set BLOB_READ_WRITE_TOKEN."
      );

      return NextResponse.json(
        {
          error:
            "Upload configuration incomplete. Please check server logs and ensure environment variables are configured.",
          details: {
            hasOidcAuth: hasOidcToken && hasBlobStoreId,
            hasTokenAuth: hasBlobToken,
            setup: "For Vercel: Connect Blob store via Project tab. For local: Run 'vercel env pull' or set BLOB_READ_WRITE_TOKEN.",
          },
        },
        { status: 503 }
      );
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      // Explicitly pass token if available (for local dev and fallback)
      // On Vercel, SDK will use OIDC automatically, so this is optional
      token: hasBlobToken || undefined,
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
    // Log detailed error server-side
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
