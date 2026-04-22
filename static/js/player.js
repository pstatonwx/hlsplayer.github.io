const form = document.getElementById("stream-form");
const streamInput = document.getElementById("stream-url");
const video = document.getElementById("video");
const statusEl = document.getElementById("status");

let hls = null;
let recoveryAttempts = 0;
const maxRecoveryAttempts = 8;

function setStatus(message, tone = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${tone}`.trim();
}

function destroyHls() {
  if (hls) {
    hls.destroy();
    hls = null;
  }
}

async function validateUrl(url) {
  try {
    const response = await fetch("/validate-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      return {
        ok: false,
        reason: payload.reason || "This stream URL is not valid.",
      };
    }

    return { ok: true };
  } catch {
    return { ok: true };
  }
}

function playWithNativeHls(url) {
  destroyHls();
  video.src = url;
  video.load();
  video
    .play()
    .then(() => setStatus("Playing stream.", "ok"))
    .catch(() =>
      setStatus("Stream is ready. Press play if autoplay is blocked.", "warn"),
    );
}

function attachHls(url) {
  destroyHls();
  recoveryAttempts = 0;

  hls = new Hls({
    enableWorker: true,
    lowLatencyMode: true,
    backBufferLength: 90,
    maxBufferLength: 40,
    maxMaxBufferLength: 120,
    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: 8,
    fragLoadingMaxRetry: 10,
    fragLoadingRetryDelay: 1000,
    fragLoadingMaxRetryTimeout: 20000,
    manifestLoadingMaxRetry: 8,
    manifestLoadingRetryDelay: 1000,
    levelLoadingMaxRetry: 8,
    levelLoadingRetryDelay: 1000,
    nudgeMaxRetry: 10,
  });

  hls.loadSource(url);
  hls.attachMedia(video);

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    video
      .play()
      .then(() => setStatus("Playing stream.", "ok"))
      .catch(() =>
        setStatus("Stream loaded. Press play if autoplay is blocked.", "warn"),
      );
  });

  hls.on(Hls.Events.ERROR, (_, data) => {
    if (!data.fatal) {
      return;
    }

    if (recoveryAttempts >= maxRecoveryAttempts) {
      setStatus("Playback could not recover. Try a different stream.", "error");
      destroyHls();
      return;
    }

    recoveryAttempts += 1;

    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        setStatus("Network hiccup detected. Reconnecting...", "warn");
        hls.startLoad();
        break;
      case Hls.ErrorTypes.MEDIA_ERROR:
        setStatus("Media error detected. Recovering...", "warn");
        hls.recoverMediaError();
        break;
      default:
        setStatus("Unexpected playback issue. Retrying...", "warn");
        hls.destroy();
        hls = null;
        setTimeout(() => attachHls(url), 1200);
        break;
    }
  });
}

async function startPlayback(url) {
  const cleaned = url.trim();
  if (!cleaned) {
    setStatus("Paste an HLS playlist URL first.", "error");
    return;
  }

  setStatus("Checking stream URL...", "warn");
  const validation = await validateUrl(cleaned);
  if (!validation.ok) {
    setStatus(validation.reason, "error");
    return;
  }

  setStatus("Loading stream...", "warn");

  if (Hls.isSupported()) {
    attachHls(cleaned);
    return;
  }

  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    playWithNativeHls(cleaned);
    return;
  }

  setStatus("Your browser does not support HLS playback.", "error");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await startPlayback(streamInput.value);
});
