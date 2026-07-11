export type JobState = "uploaded" | "transcribing" | "analyzing" | "completed" | "failed";

export type TranscriptSegment = {
  text: string;
  duration: number;
  offset: number;
  lang?: string;
};

export type Clip = {
  start: string;
  end: string;
  viralScore: number;
  title: string;
  reason: string;
  caption: string;
};

export type ProcessingJob = {
  id: string;
  state: JobState;
  source: "youtube" | "upload";
  title: string;
  channelName: string;
  thumbnailUrl: string;
  videoUrl?: string;
  blobUrl?: string;
  transcript?: TranscriptSegment[];
  clips?: Clip[];
  error?: {
    code: string;
    message: string;
  };
  createdAt: number;
  updatedAt: number;
  processingDurationMs?: number;
};

export type TranscriptDiagnostics = {
  source: "youtube" | "upload";
  status: "success" | "error";
  transcriptLength?: number;
  duration?: number;
  errorCode?: string;
  errorMessage?: string;
};

export type AnalysisDiagnostics = {
  windowsGenerated: number;
  clipsSelected: number;
  scoringDurationMs: number;
  errorCode?: string;
  errorMessage?: string;
};

export type DevDiagnostics = {
  routeStatus: "success" | "error";
  transcript: TranscriptDiagnostics;
  analysis?: AnalysisDiagnostics;
  totalDurationMs: number;
  failureCode?: string;
};
