"use client";

import { DragEvent, ChangeEvent, useEffect, useState } from "react";
type VideoInfo = {
  title: string;
  channelName: string;
  thumbnailUrl: string;
};
type Clip = {
  start: string;
  end: string;
  viralScore: number;
  title: string;
  reason: string;
  caption: string;
};

type AnalysisMode = "youtube" | "upload" | null;

const demoClips: Clip[] = [
  {
    start: "0:12",
    end: "0:28",
    viralScore: 94,
    title: "They did not expect this twist",
    reason: "Strong surprise language and clear payoff make this moment ideal for short-form.",
    caption: "You won't believe what happens next... 😳",
  },
  {
    start: "1:05",
    end: "1:26",
    viralScore: 89,
    title: "A big number reveals the real impact",
    reason: "Uses concrete numbers and strong emotion to grab attention quickly.",
    caption: "The stats in this clip make it impossible to scroll past.",
  },
  {
    start: "2:07",
    end: "2:24",
    viralScore: 88,
    title: "This question keeps you watching",
    reason: "A curiosity-driven hook combined with payoff language makes this stand out.",
    caption: "Can you guess what happens at the end? 👀",
  },
  {
    start: "3:32",
    end: "3:48",
    viralScore: 86,
    title: "The emotional payoff lands perfectly",
    reason: "Clear emotion and a satisfying result create strong short-form energy.",
    caption: "The ending here gave me chills.🔥",
  },
  {
    start: "4:10",
    end: "4:25",
    viralScore: 83,
    title: "The one line that changes everything",
    reason: "A concise, standalone moment with a clear hook and payoff.",
    caption: "This line is the moment everyone will replay.",
  },
];

function formatFileSize(bytes: number) {
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  }
  if (bytes >= 1_000) {
    return `${(bytes / 1_000).toFixed(1)} KB`;
  }
  return `${bytes} bytes`;
}

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [clips, setClips] = useState<Clip[]>([]);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [transcriptMessage, setTranscriptMessage] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    if (!uploadFile) {
      setUploadPreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(uploadFile);
    setUploadPreviewUrl(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [uploadFile]);

  function resetAnalysisState() {
    setClips([]);
    setVideoInfo(null);
    setTranscriptMessage(null);
    setUploadError(null);
    setAnalysisMode(null);
  }

  async function handleAnalyze() {
    if (!youtubeUrl.trim()) {
      alert("Paste a YouTube link first.");
      return;
    }

    resetAnalysisState();
    setIsAnalyzing(true);
    setAnalysisMode("youtube");

    try {
      const response = await fetch("/api/youtube", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: youtubeUrl.trim() }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
      }

      const data = await response.json();
      setVideoInfo({
        title: data.title ?? "Unknown video title",
        channelName: data.channelName ?? data.authorName ?? "Unknown channel",
        thumbnailUrl: data.thumbnailUrl ?? "",
      });
      setClips(data.clips ?? []);
      setTranscriptMessage(data.transcriptUnavailable ?? null);
    } catch (error) {
      console.error(error);
      alert(
        `Unable to analyze the video. Please check your URL and try again.`
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleFileSelected(file: File | null) {
    setUploadError(null);
    if (!file) {
      setUploadFile(null);
      return;
    }

    const acceptedTypes = ["video/mp4", "video/quicktime", "video/webm"];
    if (!acceptedTypes.includes(file.type)) {
      setUploadError("Only MP4, MOV, and WebM files are supported.");
      setUploadFile(null);
      return;
    }

    setUploadFile(file);
  }

  function handleUploadInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    handleFileSelected(file);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    handleFileSelected(file);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(true);
  }

  function handleDragLeave() {
    setIsDragActive(false);
  }

  function handleAnalyzeUpload() {
    if (!uploadFile) {
      setUploadError("Select a video file before analyzing.");
      return;
    }

    resetAnalysisState();
    setIsAnalyzing(true);
    setAnalysisMode("upload");

    setTimeout(() => {
      setClips(demoClips);
      setIsAnalyzing(false);
    }, 700);
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto min-h-screen max-w-6xl px-6 py-8">
        <nav className="flex items-center justify-between">
          <div className="text-xl font-bold tracking-tight">
            ViralClip <span className="text-purple-400">AI</span>
          </div>

          <button className="rounded-full border border-white/20 px-5 py-2 text-sm font-medium hover:bg-white hover:text-black">
            Sign in
          </button>
        </nav>

        <div className="mx-auto mt-24 max-w-4xl text-center">
          <div className="mb-5 inline-block rounded-full border border-purple-400/30 bg-purple-400/10 px-4 py-2 text-sm text-purple-300">
            Turn long videos into viral clips
          </div>

          <h1 className="text-5xl font-bold leading-tight sm:text-6xl md:text-7xl">
            Find the best moments in any YouTube video
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60">
            Paste a YouTube link and ViralClip AI will identify strong moments,
            timestamps, captions, and TikTok ideas.
          </p>

          <div className="mt-10 flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 sm:flex-row">
            <input
              type="url"
              value={youtubeUrl}
              onChange={(event) => setYoutubeUrl(event.target.value)}
              placeholder="Paste a YouTube link..."
              className="min-h-14 flex-1 rounded-xl border border-white/10 bg-black px-5 text-white outline-none placeholder:text-white/30 focus:border-purple-400"
            />
 
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="min-h-14 rounded-xl bg-purple-500 px-7 font-semibold hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAnalyzing ? "Analyzing..." : "Analyze video"}
            </button>
          </div>
 
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3 text-sm font-semibold text-purple-300">
              <div>Upload a video file for demo analysis</div>
              <div className="rounded-full bg-white/5 px-3 py-1 text-white/60">
                MP4, MOV, WebM
              </div>
            </div>
 
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`relative flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-4 py-6 text-center transition ${
                isDragActive
                  ? "border-purple-400 bg-purple-500/10"
                  : "border-white/15 bg-black/20"
              }`}
            >
              <input
                id="upload-input"
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={handleUploadInputChange}
                className="hidden"
              />
              <label
                htmlFor="upload-input"
                className="cursor-pointer rounded-full bg-purple-500 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-400"
              >
                Choose a file
              </label>
              <p className="max-w-xl text-sm text-white/60">
                Drag and drop a video file here, or click to select one.
              </p>
              {uploadError && (
                <p className="text-sm text-red-300">{uploadError}</p>
              )}
            </div>
 
            {uploadFile && (
              <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                <div className="rounded-3xl border border-white/10 bg-black/40 p-4">
                  <p className="text-sm uppercase tracking-widest text-white/40">
                    Selected file
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {uploadFile.name}
                  </p>
                  <p className="mt-1 text-sm text-white/60">
                    {formatFileSize(uploadFile.size)}
                  </p>
                  <p className="mt-4 text-sm text-white/60">
                    Accepted formats: MP4, MOV, WebM.
                  </p>
                </div>
 
                {uploadPreviewUrl && (
                  <div className="rounded-3xl border border-white/10 bg-black/40 p-4">
                    <p className="text-sm uppercase tracking-widest text-white/40">
                      Video preview
                    </p>
                    <video
                      src={uploadPreviewUrl}
                      controls
                      className="mt-3 h-48 w-full rounded-2xl bg-black object-cover"
                    />
                  </div>
                )}
              </div>
            )}
 
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={handleAnalyzeUpload}
                disabled={isAnalyzing}
                className="min-h-14 w-full rounded-xl bg-purple-500 px-7 py-3 text-sm font-semibold text-white hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isAnalyzing && analysisMode === "upload"
                  ? "Analyzing..."
                  : "Analyze uploaded video"}
              </button>
              <p className="text-sm text-white/50">
                Uploaded results are demo-only until real video processing is available.
              </p>
            </div>
          </div>
        </div>

        {isAnalyzing && (
          <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <div className="text-4xl">🎥</div>
            <h2 className="mt-4 text-2xl font-bold">Scanning your video</h2>
            <p className="mt-2 text-white/60">
              Looking for strong hooks, reactions, payoffs, and replayable
              moments...
            </p>
          </div>
        )}

        {videoInfo && (
          <section className="mx-auto mt-16 max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            {videoInfo.thumbnailUrl && (
              <div className="h-72 overflow-hidden sm:h-96">
                <img
                  src={videoInfo.thumbnailUrl}
                  alt={`Thumbnail for ${videoInfo.title}`}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="p-8">
              <p className="text-sm font-semibold uppercase tracking-widest text-purple-400">
                Video information
              </p>
              <h2 className="mt-3 text-3xl font-bold text-white">
                {videoInfo.title}
              </h2>
              <p className="mt-2 text-lg text-white/70">
                {videoInfo.channelName}
              </p>
            </div>
          </section>
        )}

        {transcriptMessage && (
          <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <h2 className="text-2xl font-bold">Transcript unavailable</h2>
            <p className="mt-3 text-white/60">{transcriptMessage}</p>
          </div>
        )}

        {clips.length > 0 && (
          <section className="mx-auto mt-16 max-w-4xl pb-20">
            <div className="mb-6 text-left">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold uppercase tracking-widest text-purple-400">
                  Analysis complete
                </p>
                {analysisMode === "upload" && (
                  <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold uppercase text-purple-300">
                    Demo results
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-3xl font-bold">Best clip opportunities</h2>
            </div>

            <div className="space-y-5">
              {clips.map((clip, index) => (
                <article
                  key={`${clip.start}-${clip.end}-${index}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm text-purple-300">
                        Clip #{index + 1}
                      </p>
                      <h3 className="mt-1 text-xl font-bold">{clip.title}</h3>
                    </div>

                    <div className="rounded-xl bg-purple-500/15 px-4 py-3 text-center">
                      <div className="text-2xl font-bold text-purple-300">
                        {clip.viralScore}
                      </div>
                      <div className="text-xs text-white/50">Viral score</div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                      <p className="text-xs uppercase tracking-wider text-white/40">
                        Timestamp
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        {clip.start} – {clip.end}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                      <p className="text-xs uppercase tracking-wider text-white/40">
                        TikTok caption
                      </p>
                      <p className="mt-2 font-semibold">{clip.caption}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-4">
                    <p className="text-xs uppercase tracking-wider text-white/40">
                      Why it could perform well
                    </p>
                    <p className="mt-2 text-white/70">{clip.reason}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}