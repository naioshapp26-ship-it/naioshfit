const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
]);

const VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

const normalizeHost = (host: string) => host.toLowerCase().replace(/^www\./, "");

const sanitizeVideoId = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const clean = trimmed.replace(/[^A-Za-z0-9_-]/g, "");
  return VIDEO_ID_REGEX.test(clean) ? clean : null;
};

const tryParseUrl = (rawUrl: string): URL | null => {
  try {
    return new URL(rawUrl);
  } catch {
    try {
      return new URL(`https://${rawUrl}`);
    } catch {
      return null;
    }
  }
};

export function extractYouTubeVideoId(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  const parsed = tryParseUrl(rawUrl.trim());
  if (parsed) {
    const host = normalizeHost(parsed.hostname);
    if (YOUTUBE_HOSTS.has(host)) {
      if (host === "youtu.be") {
        const shortId = sanitizeVideoId(parsed.pathname.split("/").filter(Boolean)[0]);
        if (shortId) return shortId;
      }

      const pathParts = parsed.pathname.split("/").filter(Boolean);
      const firstSegment = pathParts[0]?.toLowerCase() || "";
      const secondSegment = sanitizeVideoId(pathParts[1]);

      if (firstSegment === "watch") {
        const watchId = sanitizeVideoId(parsed.searchParams.get("v"));
        if (watchId) return watchId;
      }

      if (["shorts", "live", "embed", "v"].includes(firstSegment) && secondSegment) {
        return secondSegment;
      }
    }
  }

  // Fallback for malformed links where URL parsing fails.
  const fallbackMatch = rawUrl.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i,
  );
  return sanitizeVideoId(fallbackMatch?.[1]);
}

export function isYouTubeUrl(url: string): boolean {
  return Boolean(extractYouTubeVideoId(url));
}

export function getYouTubeEmbedUrl(url: string): string {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return url;
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
}

export function getYouTubeThumbnailUrl(url: string): string {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return "";
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}
