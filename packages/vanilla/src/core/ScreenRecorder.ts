type ScreenRecorderStartOptions = {
  onEnded?: () => void;
};

type DisplayMediaStreamOptionsWithHints = DisplayMediaStreamOptions & {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: "include" | "exclude";
  surfaceSwitching?: "include" | "exclude";
  monitorTypeSurfaces?: "include" | "exclude";
};

const MIME_TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_TYPES.find((mime) => MediaRecorder.isTypeSupported(mime));
}

export class ScreenRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private displayStream: MediaStream | null = null;
  private microphoneStream: MediaStream | null = null;
  private mixedStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private displayAudioStream: MediaStream | null = null;
  private microphoneAudioStream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private recording = false;
  private stopPromise: Promise<Blob | null> | null = null;
  private stopResolver: ((value: Blob | null) => void) | null = null;
  private lastBlob: Blob | null = null;
  private onEnded: (() => void) | null = null;
  private _hasMic = false;

  get hasMic(): boolean { return this._hasMic; }

  async start(options: ScreenRecorderStartOptions = {}): Promise<void> {
    if (this.recording) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== "function" || typeof MediaRecorder === "undefined") {
      throw new Error("This browser does not support screen recording.");
    }

    this.cleanupStreams();
    this.stopPromise = null; this.stopResolver = null;
    this.chunks = []; this.lastBlob = null;
    this.onEnded = options.onEnded ?? null;

    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 15, max: 24 }, width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 } },
      audio: true, preferCurrentTab: true, selfBrowserSurface: "include", surfaceSwitching: "include", monitorTypeSurfaces: "include",
    } as DisplayMediaStreamOptionsWithHints);
    this.displayStream = displayStream;

    let microphoneStream: MediaStream | null = null;
    this._hasMic = false;
    if (typeof navigator.mediaDevices.getUserMedia === "function") {
      try {
        microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        if (microphoneStream.getAudioTracks().length > 0) { this._hasMic = true; }
      } catch { microphoneStream = null; }
    }
    this.microphoneStream = microphoneStream;

    const mixedAudio = await this.buildMixedAudioTracks(displayStream, microphoneStream);
    const tracks = [...displayStream.getVideoTracks(), ...mixedAudio];
    if (tracks.length === 0) { this.cleanupStreams(); throw new Error("No media tracks."); }

    this.mixedStream = new MediaStream(tracks);
    const mimeType = pickMimeType();
    const opts: MediaRecorderOptions = { videoBitsPerSecond: 1_200_000, audioBitsPerSecond: 96_000 };
    if (mimeType) opts.mimeType = mimeType;

    try { this.mediaRecorder = new MediaRecorder(this.mixedStream, opts); }
    catch { this.mediaRecorder = new MediaRecorder(this.mixedStream); }

    this.mediaRecorder.ondataavailable = (e) => { if (e.data?.size > 0) this.chunks.push(e.data); };
    this.mediaRecorder.onstop = () => {
      const blob = this.chunks.length > 0 ? new Blob(this.chunks, { type: this.mediaRecorder?.mimeType || mimeType || "video/webm" }) : null;
      this.lastBlob = blob; this.recording = false; this.cleanupStreams();
      const r = this.stopResolver; this.stopPromise = null; this.stopResolver = null; r?.(blob);
    };

    for (const track of displayStream.getVideoTracks()) {
      track.onended = () => { if (this.recording) void this.stop().finally(() => this.onEnded?.()); };
    }

    this.mediaRecorder.start(1000);
    this.recording = true;
  }

  async stop(): Promise<Blob | null> {
    if (!this.recording && !this.stopPromise) return this.lastBlob;
    if (this.stopPromise) return this.stopPromise;
    if (!this.mediaRecorder) { this.recording = false; this.cleanupStreams(); return this.lastBlob; }
    this.stopPromise = new Promise<Blob | null>((resolve) => { this.stopResolver = resolve; });
    if (this.mediaRecorder.state === "inactive") this.mediaRecorder.onstop?.(new Event("stop"));
    else this.mediaRecorder.stop();
    return this.stopPromise;
  }

  isRecording(): boolean { return this.recording; }
  getLastBlob(): Blob | null { return this.lastBlob; }
  clearLastBlob(): void { this.lastBlob = null; }
  dispose(): void { this.cleanupStreams(); this.recording = false; this.stopPromise = null; this.stopResolver = null; }

  private cleanupStreams(): void {
    if (this.audioContext) void this.audioContext.close().catch(() => {});
    for (const s of [this.mixedStream, this.displayStream, this.microphoneStream, this.displayAudioStream, this.microphoneAudioStream]) {
      if (s) for (const t of s.getTracks()) t.stop();
    }
    this.mediaRecorder = null; this.mixedStream = null; this.displayStream = null; this.microphoneStream = null;
    this.audioContext = null; this.displayAudioStream = null; this.microphoneAudioStream = null;
  }

  private async buildMixedAudioTracks(display: MediaStream, mic: MediaStream | null): Promise<MediaStreamTrack[]> {
    const da = display.getAudioTracks(); const ma = mic?.getAudioTracks() ?? [];
    if (da.length === 0 && ma.length === 0) return [];
    if (typeof AudioContext === "undefined") return [...da, ...ma];
    const ctx = new AudioContext(); await ctx.resume().catch(() => {});
    const dest = ctx.createMediaStreamDestination();
    if (da.length > 0) { this.displayAudioStream = new MediaStream(da); const s = ctx.createMediaStreamSource(this.displayAudioStream); const g = ctx.createGain(); g.gain.value = 1; s.connect(g); g.connect(dest); }
    if (ma.length > 0) { this.microphoneAudioStream = new MediaStream(ma); const s = ctx.createMediaStreamSource(this.microphoneAudioStream); const g = ctx.createGain(); g.gain.value = 1; s.connect(g); g.connect(dest); }
    this.audioContext = ctx;
    const mixed = dest.stream.getAudioTracks();
    return mixed.length > 0 ? mixed : [...da, ...ma];
  }
}
