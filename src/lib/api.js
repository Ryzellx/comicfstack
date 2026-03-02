const API_BASE = "https://www.sankavollerei.com";
const API_ORIGIN = new URL(API_BASE).origin;

const DEFAULT_TIMEOUT_MS = 35000;
const RETRY_DELAYS_MS = [0, 700, 1500];
const RATE_LIMIT_MAX_REQUESTS = 50;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const FRONTEND_CACHE_PREFIX = "zetoon_cache_v3";
const memoryCache = new Map();
const inflightRequests = new Map();
const requestTimestamps = [];
export const ANIME_PROVIDER = "bacakomik";
export const MANGA_PROVIDER = "bacakomik";
export const NOVEL_PROVIDER = "sakuranovel";
const BLOCKED_ADULT_TERMS = [
  "adult",
  "18+",
  "nsfw",
  "sex",
  "seks",
  "sexual",
  "smut",
  "hentai",
  "ecchi",
  "ero",
  "erotic",
  "porn",
  "doujin",
  "mature",
  "harem",
];

function toSafeText(value, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const raw = search.toString();
  return raw ? `?${raw}` : "";
}

function normalizeExternalUrl(url) {
  let value = toSafeText(url).trim().replace(/\\\//g, "/").replace(/^['"]|['"]$/g, "");
  if (!value) return "";
  try {
    if (/%2f|%3a/i.test(value)) value = decodeURIComponent(value);
  } catch {
    // keep raw
  }
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      // Some APIs return WordPress CDN proxy host like i2.wp.com/domain/path; normalize to origin domain.
      if (/^i\d+\.wp\.com$/i.test(parsed.hostname)) {
        const segs = parsed.pathname.split("/").filter(Boolean);
        if (segs.length >= 2 && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(segs[0])) {
          const realHost = segs.shift();
          const realPath = segs.join("/");
          return `https://${realHost}/${realPath}${parsed.search || ""}`;
        }
      }
    } catch {
      // ignore parse failure
    }
    return value;
  }
  if (value.startsWith("/")) return `${API_ORIGIN}${value}`;
  if (value.startsWith("./")) return `${API_ORIGIN}/${value.replace(/^\.\/+/, "")}`;
  if (value.startsWith("//")) return `https:${value}`;
  if (/^[a-z0-9/_-]+\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(value)) return `${API_ORIGIN}/${value.replace(/^\/+/, "")}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`;
  return "";
}

function toHdImageUrl(url) {
  const raw = normalizeExternalUrl(url);
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    // Remove aggressive resize params often used for thumbnail endpoints.
    ["w", "width", "h", "height", "fit", "resize", "quality", "q"].forEach((key) =>
      parsed.searchParams.delete(key)
    );

    // Convert common WordPress thumbnail filename variants to original file.
    parsed.pathname = parsed.pathname.replace(/-\d{2,4}x\d{2,4}(?=\.(jpg|jpeg|png|webp|gif)$)/i, "");
    return parsed.toString();
  } catch {
    return raw.replace(/-\d{2,4}x\d{2,4}(?=\.(jpg|jpeg|png|webp|gif)$)/i, "");
  }
}

function extractSizeScore(url) {
  const text = toSafeText(url).toLowerCase();
  const match = text.match(/(\d{2,4})x(\d{2,4})/);
  if (!match) return 0;
  const w = Number.parseInt(match[1], 10);
  const h = Number.parseInt(match[2], 10);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return 0;
  return w * h;
}

function imagePenalty(url) {
  const text = toSafeText(url).toLowerCase();
  let penalty = 0;
  if (text.includes("thumb")) penalty += 400000;
  if (text.includes("thumbnail")) penalty += 400000;
  if (text.includes("small")) penalty += 300000;
  if (text.includes("low")) penalty += 300000;
  if (text.includes("avatar")) penalty += 500000;
  return penalty;
}

function pickBestImageUrl(candidates = []) {
  const normalized = candidates
    .map((url) => toHdImageUrl(url))
    .filter(Boolean);

  if (normalized.length === 0) return "";
  if (normalized.length === 1) return normalized[0];

  const sorted = [...normalized].sort((a, b) => {
    const scoreA = extractSizeScore(a) - imagePenalty(a);
    const scoreB = extractSizeScore(b) - imagePenalty(b);
    return scoreB - scoreA;
  });

  return sorted[0] || normalized[0];
}

function toDisplayImageUrl(url, width = 600, height = 900) {
  const src = normalizeExternalUrl(url);
  if (!src) return "";
  try {
    const parsed = new URL(src);
    if (parsed.hostname.includes("images.weserv.nl")) return parsed.toString();
  } catch {
    // keep going
  }
  const normalized = src.replace(/^https?:\/\//i, "");
  return `https://images.weserv.nl/?url=${encodeURIComponent(normalized)}&w=${width}&h=${height}&fit=cover`;
}

function extractImageCandidates(item) {
  if (!item || typeof item !== "object") return [];
  const direct = [
    item.poster,
    item.cover,
    item.image,
    item.img,
    item.thumbnail,
    item.thumb,
    item.banner,
    item.wallpaper,
  ];

  const nested = [];
  walkDeep(item, (arr) => {
    arr.forEach((entry) => {
      if (typeof entry === "string" && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(entry)) nested.push(entry);
      if (entry && typeof entry === "object") {
        ["poster", "cover", "image", "img", "thumbnail", "thumb", "banner"].forEach((key) => {
          if (entry[key]) nested.push(entry[key]);
        });
      }
    });
  });

  return [...direct, ...nested].filter(Boolean);
}

function parseNumberish(value) {
  const text = toSafeText(value).replace(",", ".");
  const match = text.match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  const num = Number.parseFloat(match[1]);
  return Number.isFinite(num) ? num : null;
}

function resolveTimestampMs(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    // Treat small numbers as seconds timestamps.
    return value < 1e12 ? value * 1000 : value;
  }

  const text = toSafeText(value).trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) {
    const asNumber = Number.parseInt(text, 10);
    if (!Number.isFinite(asNumber)) return null;
    return asNumber < 1e12 ? asNumber * 1000 : asNumber;
  }

  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) return parsed;
  return null;
}

function toRelativeTimeId(value) {
  const text = toSafeText(value).trim();
  if (!text) return "";
  if (/lalu$/i.test(text)) return text;

  const lowered = text.toLowerCase();
  if (/(just now|baru saja|new|recently)/i.test(lowered)) return "baru saja";
  if (/(yesterday|kemarin)/i.test(lowered)) return "1 hari lalu";

  const minuteMatch = lowered.match(/(\d+)\s*(menit|minute|minutes|min|mins)\b/i);
  if (minuteMatch) return `${Number.parseInt(minuteMatch[1], 10)} menit lalu`;

  const hourMatch = lowered.match(/(\d+)\s*(jam|hour|hours|hr|hrs)\b/i);
  if (hourMatch) return `${Number.parseInt(hourMatch[1], 10)} jam lalu`;

  const dayMatch = lowered.match(/(\d+)\s*(hari|day|days)\b/i);
  if (dayMatch) return `${Number.parseInt(dayMatch[1], 10)} hari lalu`;

  const timestampMs = resolveTimestampMs(value);
  if (!timestampMs) return "";

  const diffMs = Date.now() - timestampMs;
  if (!Number.isFinite(diffMs) || diffMs <= 0) return "baru saja";

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < hourMs) {
    const minutes = Math.max(1, Math.floor(diffMs / minuteMs));
    return `${minutes} menit lalu`;
  }
  if (diffMs < dayMs) {
    const hours = Math.max(1, Math.floor(diffMs / hourMs));
    return `${hours} jam lalu`;
  }
  const days = Math.max(1, Math.floor(diffMs / dayMs));
  return `${days} hari lalu`;
}

function normalizeForFilter(value) {
  return toSafeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAdultTerms(value) {
  const text = normalizeForFilter(value);
  if (!text) return false;
  return BLOCKED_ADULT_TERMS.some((term) => text.includes(term));
}

function sanitizeGenres(value) {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((item) => toSafeText(typeof item === "string" ? item : item?.name || item?.genre || item?.title).trim())
    .filter(Boolean)
    .filter((genre) => !hasAdultTerms(genre));
}

function isAdultContent(item) {
  if (!item || typeof item !== "object") return false;
  const fields = [
    item.title,
    item.name,
    item.judul,
    item.type,
    item.status,
    item.sinopsis,
    item.synopsis,
    item.description,
    ...(Array.isArray(item.genre) ? item.genre : []),
    ...(Array.isArray(item.genres) ? item.genres : []),
  ];
  return fields.some((value) => hasAdultTerms(value));
}

function buildCacheKey(url) {
  return `${FRONTEND_CACHE_PREFIX}:${url}`;
}

function readCachedValue(cacheKey) {
  const now = Date.now();
  const inMemory = memoryCache.get(cacheKey);
  if (inMemory && inMemory.expiresAt > now) return inMemory.value;

  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.expiresAt <= now) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    memoryCache.set(cacheKey, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCachedValue(cacheKey, value, ttlMs) {
  const entry = {
    value,
    expiresAt: Date.now() + Math.max(ttlMs, 1000),
  };
  memoryCache.set(cacheKey, entry);
  try {
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch {
    // ignore storage quota/unavailable
  }
}

function enforceClientRateLimit() {
  const now = Date.now();
  while (requestTimestamps.length > 0 && now - requestTimestamps[0] > RATE_LIMIT_WINDOW_MS) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - requestTimestamps[0]);
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
    throw new Error(`Terlalu banyak request. Coba lagi dalam ${retryAfterSec} detik.`);
  }

  requestTimestamps.push(now);
}

async function fetchJson(path, params = {}, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS, cacheTtlMs = 0) {
  const basePath = path.startsWith("/") ? path : `/${path}`;
  const normalizedPath =
    basePath.startsWith("/comic/") || basePath.startsWith("/novel/") ? basePath : `/comic${basePath}`;
  const url = `${API_BASE}${normalizedPath}${toQuery(params)}`;
  const cacheKey = buildCacheKey(url);
  const method = String(init?.method || "GET").toUpperCase();
  const canUseCache = method === "GET" && cacheTtlMs > 0;

  if (canUseCache) {
    const cached = readCachedValue(cacheKey);
    if (cached != null) return cached;
    const inflight = inflightRequests.get(cacheKey);
    if (inflight) return inflight;
  }

  enforceClientRateLimit();

  const networkRequest = (async () => {
    try {
      let lastError = null;

      for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
        if (RETRY_DELAYS_MS[attempt] > 0) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(url, {
            ...init,
            signal: controller.signal,
            headers: {
              Accept: "application/json",
              ...(init.headers || {}),
            },
          });

          if (!response.ok) {
            throw new Error(`Permintaan gagal (${response.status}).`);
          }

          const payload = await response.json();
          if (canUseCache) writeCachedValue(cacheKey, payload, cacheTtlMs);
          return payload;
        } catch (error) {
          lastError = error;
          const isTimeout = error?.name === "AbortError";
          const isFetchFailure = /failed to fetch|networkerror|load failed/i.test(toSafeText(error?.message));
          const shouldRetry = attempt < RETRY_DELAYS_MS.length - 1 && (isTimeout || isFetchFailure);
          if (!shouldRetry) break;
        } finally {
          clearTimeout(timer);
        }
      }

      if (canUseCache) {
        const stale = readCachedValue(cacheKey);
        if (stale != null) return stale;
      }

      if (lastError?.name === "AbortError") {
        throw new Error("Koneksi timeout. Coba lagi.");
      }

      if (/failed to fetch|networkerror|load failed/i.test(toSafeText(lastError?.message))) {
        throw new Error("Gagal terhubung ke server. Periksa koneksi lalu coba lagi.");
      }

      throw lastError || new Error("Permintaan gagal.");
    } finally {
      if (canUseCache) inflightRequests.delete(cacheKey);
    }
  })();

  if (canUseCache) inflightRequests.set(cacheKey, networkRequest);

  return networkRequest;
}

function walkDeep(value, visitor, depth = 0) {
  if (depth > 7 || value == null) return;
  if (Array.isArray(value)) {
    visitor(value);
    value.forEach((item) => walkDeep(item, visitor, depth + 1));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => walkDeep(item, visitor, depth + 1));
  }
}

function pickArrayPayload(payload) {
  if (Array.isArray(payload)) return payload;

  const directCandidates = [
    payload?.result,
    payload?.results,
    payload?.data,
    payload?.list,
    payload?.items,
    payload?.komik,
    payload?.comics,
  ];

  const direct = directCandidates.find((item) => Array.isArray(item) && item.length > 0);
  if (Array.isArray(direct)) return direct;

  let best = [];
  walkDeep(payload, (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return;
    const hasObjectLike = arr.some((item) => item && typeof item === "object");
    if (!hasObjectLike) return;
    if (arr.length > best.length) best = arr;
  });

  return Array.isArray(best) ? best : [];
}

function pickObjectPayload(payload) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const candidates = [payload.result, payload.data, payload.detail, payload.comic];
    const direct = candidates.find((item) => item && typeof item === "object" && !Array.isArray(item));
    if (direct) return direct;
    return payload;
  }
  return {};
}

function findChapterList(obj = {}) {
  const directCandidates = [obj?.chapter, obj?.chapters, obj?.chapterList, obj?.listChapter, obj?.list_chapter, obj?.episode];
  const direct = directCandidates.find((item) => Array.isArray(item));
  if (Array.isArray(direct)) return direct;

  let best = [];
  walkDeep(obj, (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return;
    const hasChapterShape = arr.some((item) => {
      if (!item || typeof item !== "object") return false;
      const text = `${toSafeText(item?.title)} ${toSafeText(item?.name)} ${toSafeText(item?.chapter)} ${toSafeText(item?.slug)}`.toLowerCase();
      return text.includes("chapter") || text.includes("ch ") || Boolean(item?.slug);
    });
    if (!hasChapterShape) return;
    if (arr.length > best.length) best = arr;
  });

  return best;
}

function normalizeComicItem(item) {
  if (!item || typeof item !== "object") return null;

  const slug = toSafeText(item.slug || item.href || item.url || item.id)
    .replace(/^.*\/comic\//i, "")
    .replace(/^.*\//, "")
    .trim();
  const title = toSafeText(item.title || item.name || item.judul || item.headline || item.nama).trim() || "Untitled Comic";
  const posterRaw = pickBestImageUrl(extractImageCandidates(item));
  const poster = toDisplayImageUrl(posterRaw, 600, 900);
  const chapterText = toSafeText(item.chapter || item.latestChapter || item.lastChapter || item.last_chapter || item.episode || item.latest || "");
  const type = toSafeText(item.type || item.jenis || "").toLowerCase();
  const mediaType = ["manga", "manhwa", "manhua"].includes(type) ? type : "manga";

  return {
    ...item,
    id: slug || title,
    animeId: slug || title,
    animeSlug: slug || "",
    mediaType,
    source: ANIME_PROVIDER,
    title,
    poster,
    posterRaw,
    synopsis: toSafeText(item.sinopsis || item.synopsis || item.description || ""),
    score: parseNumberish(item.rating || item.score),
    status: toSafeText(item.status || item.state || ""),
    type,
    episodesText: chapterText || toSafeText(item.status || item.type || "Update"),
  };
}

function normalizeNovelItem(item) {
  if (!item || typeof item !== "object") return null;

  const slug = toSafeText(item.slug || item.href || item.url || item.id)
    .replace(/^.*\/detail\//i, "")
    .replace(/^.*\/novel\//i, "")
    .replace(/^.*\//, "")
    .trim();
  const title = toSafeText(item.judul || item.title || item.name || item.headline || item.nama).trim() || "Untitled Novel";
  const chapterText = toSafeText(item.chapter || item.latestChapter || item.lastChapter || item.last_chapter || item.episode || item.latest || "");

  return {
    ...item,
    id: slug || title,
    animeId: slug || title,
    animeSlug: slug || "",
    mediaType: "novel",
    source: NOVEL_PROVIDER,
    title,
    poster: "",
    posterRaw: "",
    synopsis: toSafeText(item.sinopsis || item.synopsis || item.description || ""),
    score: parseNumberish(item.rating || item.score),
    status: toSafeText(item.status || item.state || ""),
    type: "novel",
    episodesText: chapterText || toSafeText(item.status || "Update"),
  };
}

export function extractList(payload) {
  return pickArrayPayload(payload)
    .filter((item) => !isAdultContent(item))
    .map(normalizeComicItem)
    .filter(Boolean);
}

export function extractMangaList(payload) {
  return extractList(payload);
}

export function extractNovelList(payload) {
  return pickArrayPayload(payload)
    .filter((item) => !isAdultContent(item))
    .map(normalizeNovelItem)
    .filter(Boolean);
}

export function extractGenreList(payload) {
  const list = pickArrayPayload(payload);

  return list
    .map((item) => {
      if (typeof item === "string") {
        const clean = item.trim();
        return { name: clean, slug: clean };
      }
      const name = toSafeText(item?.name || item?.genre || item?.title || item?.label).trim();
      const slug = toSafeText(item?.slug || item?.name || item?.genre || item?.title).trim();
      return { name, slug };
    })
    .filter((item) => item.name && item.slug)
    .filter((item) => !hasAdultTerms(item.name) && !hasAdultTerms(item.slug));
}

export function extractObject(payload) {
  const result = pickObjectPayload(payload);
  const normalized =
    normalizeComicItem(result) ||
    normalizeNovelItem(result) ||
    {};
  const chapters = findChapterList(result);
  const isNovel = normalized.source === NOVEL_PROVIDER || normalized.mediaType === "novel";

  return {
    ...normalized,
    animeId: normalized.animeId || toSafeText(result?.slug) || "",
    animeSlug: normalized.animeSlug || toSafeText(result?.slug) || "",
    title: normalized.title || "Untitled Comic",
    poster: isNovel ? "" : normalized.poster || toDisplayImageUrl(pickBestImageUrl(extractImageCandidates(result)), 800, 1200),
    synopsis: toSafeText(result?.sinopsis || result?.synopsis || result?.description || normalized.synopsis || ""),
    posterRaw: isNovel ? "" : normalized.posterRaw || pickBestImageUrl(extractImageCandidates(result)),
    status: normalized.status || toSafeText(result?.status || ""),
    episodes: chapters.length,
    score: normalized.score,
    genre: sanitizeGenres(Array.isArray(result?.genre) ? result.genre : Array.isArray(result?.genres) ? result.genres : []),
  };
}

export function extractHomeLists(payload) {
  return {
    spotlight: extractList(payload?.recommendation || payload?.recomen || payload?.recommend).slice(0, 16),
    trending: extractList(payload?.top).slice(0, 16),
    latestEpisodes: extractList(payload?.latest).slice(0, 16),
    topAiring: extractList(payload?.popular || payload?.populer).slice(0, 16),
    mostPopular: extractList(payload?.popular || payload?.populer).slice(0, 16),
    latestCompleted: extractList(payload?.list).slice(0, 16),
    topUpcoming: extractList(payload?.komikberwarna).slice(0, 16),
  };
}

export function extractEpisodeList(payload) {
  const result = pickObjectPayload(payload);
  const baseList = findChapterList(result);

  return baseList
    .map((chapter, index) => {
      const chapterSlug = toSafeText(chapter?.slug || chapter?.href || chapter?.url || chapter?.id)
        .replace(/^.*\/chapter\//i, "")
        .replace(/^.*\//, "")
        .trim();
      const rawTitle = toSafeText(chapter?.title || chapter?.name || chapter?.chapter || chapter?.judul);
      const slugText = toSafeText(chapterSlug).replace(/[-_]+/g, " ");
      const numMatch = rawTitle.match(/(\d+(\.\d+)?)/) || slugText.match(/(\d+(\.\d+)?)/);
      const inferredNumber = numMatch ? Number.parseFloat(numMatch[1]) : index + 1;
      const number = Number.isFinite(inferredNumber) ? inferredNumber : index + 1;
      const chapterPrefix = `Chapter ${number}`;
      const title = rawTitle
        ? /^chapter\s*\d+/i.test(rawTitle)
          ? rawTitle
          : `${chapterPrefix} - ${rawTitle}`
        : chapterPrefix;
      const releaseRaw =
        chapter?.timeAgo ||
        chapter?.time_ago ||
        chapter?.ago ||
        chapter?.uploaded ||
        chapter?.uploadTime ||
        chapter?.upload_time ||
        chapter?.dateUpload ||
        chapter?.date_upload ||
        chapter?.released ||
        chapter?.releaseDate ||
        chapter?.release_date ||
        chapter?.updatedAt ||
        chapter?.updated_at ||
        chapter?.createdAt ||
        chapter?.created_at ||
        chapter?.publishAt ||
        chapter?.publishedAt ||
        chapter?.published_at ||
        chapter?.postDate ||
        chapter?.post_date ||
        chapter?.date ||
        chapter?.tanggal ||
        chapter?.postedOn ||
        chapter?.posted_on ||
        "";
      const releaseText = toRelativeTimeId(releaseRaw);

      return {
        ...chapter,
        id: chapterSlug || rawTitle || String(index + 1),
        episodeId: chapterSlug,
        number,
        title,
        releaseText,
        animeId: toSafeText(result?.slug || payload?.slug || ""),
        animeSlug: toSafeText(result?.slug || payload?.slug || ""),
      };
    })
    .filter((item) => item.episodeId || item.id);
}

export function extractCharacterList() {
  return [];
}

export function extractStreamingLinks() {
  return [];
}

export function extractVideoList() {
  return [];
}

export function extractRecommendationList(payload) {
  return extractList(payload);
}

export function extractChapterImages(payload) {
  const result = pickObjectPayload(payload);

  const directCandidates = [
    result?.images,
    result?.image,
    result?.img,
    result?.pages,
    result?.chapter_image,
    result?.chapterImages,
    result?.chapter_images,
    result?.chapterImage,
    result?.data,
    payload?.images,
    payload?.pages,
    payload?.data,
  ];
  const direct = directCandidates.find((item) => Array.isArray(item));
  const list = Array.isArray(direct) ? direct : [];

  const fromDirect = list
    .map((item) => {
      if (typeof item === "string") return normalizeExternalUrl(item);
      return normalizeExternalUrl(item?.url || item?.src || item?.image || item?.img || item?.dataSrc || item?.lazySrc || "");
    })
    .filter(Boolean);

  if (fromDirect.length > 0) return fromDirect;

  const isLikelyChapterImage = (url) => {
    const value = toSafeText(url).trim();
    if (!value) return false;
    if (/(\.jpg|\.jpeg|\.png|\.webp|\.gif|\.avif|\.bmp|\.svg)(\?|$)/i.test(value)) return true;
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.toLowerCase();
      const path = parsed.pathname.toLowerCase();
      const disallowed =
        /(\.html|\.php|\.json|\.js)(\?|$)/i.test(path) ||
        path.includes("/chapter/") ||
        path.includes("/detail/");
      if (disallowed) return false;
      const imageLikeHost = host.includes("img") || host.includes("image") || host.includes("cdn");
      const imageLikePath =
        path.includes("/wp-content/") ||
        path.includes("/uploads/") ||
        path.includes("/images/") ||
        path.includes("/img/");
      return imageLikeHost || imageLikePath;
    } catch {
      return false;
    }
  };

  const found = [];
  walkDeep(payload, (arr) => {
    arr.forEach((item) => {
      const url =
        typeof item === "string"
          ? normalizeExternalUrl(item)
          : normalizeExternalUrl(item?.url || item?.src || item?.image || item?.img || item?.dataSrc || item?.lazySrc || "");
      if (!url) return;
      if (!isLikelyChapterImage(url)) return;
      found.push(url);
    });
  });

  return Array.from(new Set(found));
}

export function extractNovelReadContent(payload) {
  const result = pickObjectPayload(payload);
  const htmlRaw =
    toSafeText(result?.content) ||
    toSafeText(result?.chapterContent) ||
    toSafeText(result?.chapter_content) ||
    toSafeText(result?.body) ||
    toSafeText(result?.text) ||
    "";

  const paragraphCandidates = [
    result?.paragraphs,
    result?.contents,
    result?.contentList,
    result?.chapters,
  ].find((item) => Array.isArray(item));

  const paragraphs = Array.isArray(paragraphCandidates)
    ? paragraphCandidates
        .map((item) => (typeof item === "string" ? item : toSafeText(item?.text || item?.content || item?.body)))
        .filter(Boolean)
    : [];

  // Basic hardening to avoid script/style injection if API returns raw HTML.
  const safeHtml = htmlRaw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "");

  return {
    html: safeHtml,
    paragraphs,
  };
}

export const api = {
  getHome: async () => {
    const [latest, popular, top, list, recommendation, komikberwarna] = await Promise.allSettled([
      fetchJson("/bacakomik/latest", {}, {}, DEFAULT_TIMEOUT_MS, 120000),
      fetchJson("/bacakomik/populer", {}, {}, DEFAULT_TIMEOUT_MS, 120000),
      fetchJson("/bacakomik/top", {}, {}, DEFAULT_TIMEOUT_MS, 120000),
      fetchJson("/bacakomik/list", {}, {}, DEFAULT_TIMEOUT_MS, 120000),
      fetchJson("/bacakomik/recomen", {}, {}, DEFAULT_TIMEOUT_MS, 120000),
      fetchJson("/bacakomik/komikberwarna/1", {}, {}, DEFAULT_TIMEOUT_MS, 120000),
    ]);

    return {
      latest: latest.status === "fulfilled" ? latest.value : {},
      popular: popular.status === "fulfilled" ? popular.value : {},
      top: top.status === "fulfilled" ? top.value : {},
      list: list.status === "fulfilled" ? list.value : {},
      recommendation: recommendation.status === "fulfilled" ? recommendation.value : {},
      komikberwarna: komikberwarna.status === "fulfilled" ? komikberwarna.value : {},
    };
  },

  searchAnime: (query) =>
    fetchJson(`/bacakomik/search/${encodeURIComponent(query || "")}`, {}, {}, DEFAULT_TIMEOUT_MS, 180000),

  getSearchSuggestions: () => Promise.resolve({ data: [] }),
  getAzList: () => Promise.resolve({ data: [] }),
  getAnimeQtip: () => Promise.resolve({ data: {} }),
  getCategoryAnime: () => Promise.resolve({ data: [] }),
  getGenres: () => fetchJson("/comic/bacakomik/genres", {}, {}, DEFAULT_TIMEOUT_MS, 21600000),
  getGenreAnime: (slug) => fetchJson(`/comic/bacakomik/genre/${encodeURIComponent(slug || "")}`, {}, {}, DEFAULT_TIMEOUT_MS, 300000),
  getProducerAnime: () => Promise.resolve({ data: [] }),
  getSchedule: () => Promise.resolve({ data: [] }),
  getNextEpisodeSchedule: () => Promise.resolve({ data: {} }),

  getAnimeDetail: (animeId, options = {}) => {
    const source = typeof options === "string" ? options : options?.source || ANIME_PROVIDER;
    if (source === NOVEL_PROVIDER) {
      return fetchJson(`/novel/sakuranovel/detail/${encodeURIComponent(animeId || "")}`, {}, {}, DEFAULT_TIMEOUT_MS, 300000);
    }
    return fetchJson(`/comic/bacakomik/detail/${encodeURIComponent(animeId || "")}`, {}, {}, DEFAULT_TIMEOUT_MS, 300000);
  },

  getAnimeEpisodes: (animeId, options = {}) => {
    const source = typeof options === "string" ? options : options?.source || ANIME_PROVIDER;
    if (source === NOVEL_PROVIDER) {
      return fetchJson(`/novel/sakuranovel/detail/${encodeURIComponent(animeId || "")}`, {}, {}, DEFAULT_TIMEOUT_MS, 300000);
    }
    return fetchJson(`/comic/bacakomik/detail/${encodeURIComponent(animeId || "")}`, {}, {}, DEFAULT_TIMEOUT_MS, 300000);
  },

  getAnimeCharacters: () => Promise.resolve({ data: [] }),
  getAnimeStreaming: () => Promise.resolve({ data: [] }),
  getAnimeVideos: () => Promise.resolve({ data: [] }),
  getAnimeRecommendations: (_, options = {}) => {
    const source = typeof options === "string" ? options : options?.source || ANIME_PROVIDER;
    if (source === NOVEL_PROVIDER) {
      return fetchJson("/novel/sakuranovel/home", {}, {}, DEFAULT_TIMEOUT_MS, 180000);
    }
    return fetchJson("/comic/bacakomik/recomen", {}, {}, DEFAULT_TIMEOUT_MS, 180000);
  },

  getEpisodeServers: () => Promise.resolve({ data: { sub: [], dub: [], raw: [] } }),

  getEpisodeSources: async ({ animeEpisodeId }) => {
    const payload = await fetchJson(`/comic/bacakomik/chapter/${encodeURIComponent(animeEpisodeId || "")}`, {}, {}, DEFAULT_TIMEOUT_MS, 300000);
    return {
      data: {
        sources: extractChapterImages(payload).map((url, index) => ({ quality: `Page ${index + 1}`, url })),
      },
      payload,
    };
  },

  getTopManga: () => fetchJson("/comic/bacakomik/top", {}, {}, DEFAULT_TIMEOUT_MS, 120000),
  searchManga: (query) => fetchJson(`/comic/bacakomik/search/${encodeURIComponent(query || "")}`, {}, {}, DEFAULT_TIMEOUT_MS, 180000),
  getMangaDetail: (slug) => fetchJson(`/comic/bacakomik/detail/${encodeURIComponent(slug || "")}`, {}, {}, DEFAULT_TIMEOUT_MS, 300000),
  getMangaCharacters: () => Promise.resolve({ data: [] }),
  getMangaRecommendations: () => fetchJson("/comic/bacakomik/recomen", {}, {}, DEFAULT_TIMEOUT_MS, 180000),

  getKomikByType: (type) => fetchJson(`/comic/bacakomik/only/${encodeURIComponent(type || "")}`, {}, {}, DEFAULT_TIMEOUT_MS, 120000),
  getKomikBerwarna: (page = 1) => fetchJson(`/comic/bacakomik/komikberwarna/${encodeURIComponent(page)}`, {}, {}, DEFAULT_TIMEOUT_MS, 120000),
  getChapter: (slug, options = {}) => {
    const source = typeof options === "string" ? options : options?.source || ANIME_PROVIDER;
    if (source === NOVEL_PROVIDER) {
      return fetchJson(`/novel/sakuranovel/read/${encodeURIComponent(slug || "")}`, {}, {}, DEFAULT_TIMEOUT_MS, 300000);
    }
    return fetchJson(`/comic/bacakomik/chapter/${encodeURIComponent(slug || "")}`, {}, {}, DEFAULT_TIMEOUT_MS, 300000);
  },

  getNovelHome: () => fetchJson("/novel/sakuranovel/home", {}, {}, DEFAULT_TIMEOUT_MS, 120000),
  searchNovel: (query) => fetchJson("/novel/sakuranovel/search", { q: query || "" }, {}, DEFAULT_TIMEOUT_MS, 180000),
  getNovelGenres: () => fetchJson("/novel/sakuranovel/genres", {}, {}, DEFAULT_TIMEOUT_MS, 21600000),
  getNovelByGenre: (slug) => fetchJson(`/novel/sakuranovel/genre/${encodeURIComponent(slug || "")}`, {}, {}, DEFAULT_TIMEOUT_MS, 300000),
  getNovelTags: () => fetchJson("/novel/sakuranovel/tags", {}, {}, DEFAULT_TIMEOUT_MS, 21600000),
  getNovelByTag: (slug) => fetchJson(`/novel/sakuranovel/tag/${encodeURIComponent(slug || "")}`, {}, {}, DEFAULT_TIMEOUT_MS, 300000),
  getNovelAzList: () => fetchJson("/novel/sakuranovel/daftar-novel", {}, {}, DEFAULT_TIMEOUT_MS, 300000),
};

