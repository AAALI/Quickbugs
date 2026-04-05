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

function mapRecorderError(error: unknown): Error {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return new Error("Screen or microphone permission was denied.");
    }
    if (error.name === "AbortError") {
      return new Error("Recording setup was cancelled before it started.");
    }
    if (error.name === "NotFoundError") {
      return new Error("No screen/tab or microphone source was found.");
    }
    if (error.name === "NotReadableError") {
      return new Error("Unable to access the selected screen/tab or microphone.");
    }
    return new Error(error.message || "Failed to start recording.");
  }
  if (error instanceof Error) return error;
  return new Error("Failed to start recording.");
}

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

  get hasMic(): boolean {
    return this._hasMic;
  }

  async start(options: ScreenRecorderStartOptions = {}): Promise<void> {
    if (this.recording) return;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !== "function" ||
      typeof MediaRecorder === "undefined"
    ) {
      throw new Error("This browser does not support screen recording.");
    }

    this.cleanupStreams();
    this.resetStopPromise();
    this.chunks = [];
    this.lastBlob = null;
    this.onEnded = options.onEnded ?? null;

    try {
      const displayOptions: DisplayMediaStreamOptionsWithHints = {
        video: { frameRate: { ideal: 15, max: 24 }, width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 } },
        audio: true,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        surfaceSwitching: "include",
        monitorTypeSurfaces: "include",
      };

      const displayStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);
      this.displayStream = displayStream;

      let microphoneStream: MediaStream | null = null;
      this._hasMic = false;

      if (typeof navigator.mediaDevices.getUserMedia === "function") {
        try {
          microphoneStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: false,
          });
          const micAudioTracks = microphoneStream.getAudioTracks();
          if (micAudioTracks.length > 0) {
            this._hasMic = true;
            for (const track of micAudioTracks) track.enabled = true;
          }
        } catch {
          console.warn("[QuickBugs] Microphone unavailable — recording without mic audio.");
          microphoneStream = null;
        }
      }

      this.microphoneStream = microphoneStream;
      const mixedAudioTracks = await this.buildMixedAudioTracks(displayStream, microphoneStream);
      const tracks = [...displayStream.getVideoTracks(), ...mixedAudioTracks];

      if (tracks.length === 0) {
        for (const track of displayStream.getTracks()) track.stop();
        if (microphoneStream) for (const track of microphoneStream.getTracks()) track.stop();
        throw new Error("No media tracks available for recording.");
      }

      this.mixedStream = new MediaStream(tracks);
      const mimeType = pickMimeType();
      const recorderOptions: MediaRecorderOptions = { videoBitsPerSecond: 1_200_000, audioBitsPerSecond: 96_000 };
      if (mimeType) recorderOptions.mimeType = mimeType;

      try {
        this.mediaRecorder = new MediaRecorder(this.mixedStream, recorderOptions);
      } catch {
        if (mimeType) {
          try { this.mediaRecorder = new MediaRecorder(this.mixedStream, { mimeType }); }
          catch { this.mediaRecorder = new MediaRecorder(this.mixedStream); }
        } else {
          this.mediaRecorder = new MediaRecorder(this.mixedStream);
        }
      }

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) this.chunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        const mime = this.mediaRecorder?.mimeType || mimeType || "video/webm";
        const blob = this.chunks.length > 0 ? new Blob(this.chunks, { type: mime }) : null;
        this.lastBlob = blob;
        this.recording = false;
        this.cleanupStreams();
        const resolve = this.stopResolver;
        this.resetStopPromise();
        resolve?.(blob);
      };

      for (const track of displayStream.getVideoTracks()) {
        track.onended = () => {
          if (!this.recording) return;
          void this.stop().finally(() => { this.onEnded?.(); });
        };
      }

      this.mediaRecorder.start(1000);
      this.recording = true;
    } catch (error) {
      this.cleanupStreams();
      this.recording = false;
      throw mapRecorderError(error);
    }
  }

  async stop(): Promise<Blob | null> {
    if (!this.recording && !this.stopPromise) return this.lastBlob;
    if (this.stopPromise) return this.stopPromise;
    if (!this.mediaRecorder) {
      this.recording = false;
      this.cleanupStreams();
      return this.lastBlob;
    }

    this.stopPromise = new Promise<Blob | null>((resolve) => { this.stopResolver = resolve; });

    if (this.mediaRecorder.state === "inactive") {
      this.mediaRecorder.onstop?.(new Event("stop"));
    } else {
      this.mediaRecorder.stop();
    }

    return this.stopPromise;
  }

  isRecording(): boolean { return this.recording; }
  getLastBlob(): Blob | null { return this.lastBlob; }
  clearLastBlob(): void { this.lastBlob = null; }

  dispose(): void {
    this.cleanupStreams();
    this.recording = false;
    this.resetStopPromise();
  }

  private cleanupStreams(): void {
    if (this.audioContext) void this.audioContext.close().catch(() => undefined);
    for (const stream of [this.mixedStream, this.displayStream, this.microphoneStream, this.displayAudioStream, this.microphoneAudioStream]) {
      if (stream) for (const track of stream.getTracks()) track.stop();
    }
    this.mediaRecorder = null;
    this.mixedStream = null;
    this.displayStream = null;
    this.microphoneStream = null;
    this.audioContext = null;
    this.displayAudioStream = null;
    this.microphoneAudioStream = null;
  }

  private resetStopPromise(): void {
    this.stopPromise = null;
    this.stopResolver = null;
  }

  private async buildMixedAudioTracks(displayStream: MediaStream, microphoneStream: MediaStream | null): Promise<MediaStreamTrack[]> {
    const displayAudioTracks = displayStream.getAudioTracks();
    const microphoneAudioTracks = microphoneStream?.getAudioTracks() ?? [];

    if (displayAudioTracks.length === 0 && microphoneAudioTracks.length === 0) return [];
    if (typeof AudioContext === "undefined") return [...displayAudioTracks, ...microphoneAudioTracks];

    const audioContext = new AudioContext();
    await audioContext.resume().catch(() => undefined);
    const destination = audioContext.createMediaStreamDestination();

    if (displayAudioTracks.length > 0) {
      this.displayAudioStream = new MediaStream(displayAudioTracks);
      const source = audioContext.createMediaStreamSource(this.displayAudioStream);
      const gain = audioContext.createGain();
      gain.gain.value = 1;
      source.connect(gain);
      gain.connect(destination);
    }

    if (microphoneAudioTracks.length > 0) {
      this.microphoneAudioStream = new MediaStream(microphoneAudioTracks);
      const source = audioContext.createMediaStreamSource(this.microphoneAudioStream);
      const gain = audioContext.createGain();
      gain.gain.value = 1;
      source.connect(gain);
      gain.connect(destination);
    }

    this.audioContext = audioContext;
    const mixedAudioTracks = destination.stream.getAudioTracks();
    return mixedAudioTracks.length > 0 ? mixedAudioTracks : [...displayAudioTracks, ...microphoneAudioTracks];
  }
}
