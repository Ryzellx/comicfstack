import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

function toSafeText(value, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function toAnimePath(anime) {
  const source = toSafeText(anime?.source || "bacakomik");
  const animeId = toSafeText(anime?.animeId || anime?.id);
  const slug = toSafeText(anime?.animeSlug);
  const rawType = toSafeText(anime?.type || anime?.mediaType).toLowerCase();
  const mediaType = ["manga", "manhwa", "manhua", "novel"].includes(rawType) ? rawType : "";
  if (!animeId) return "#";
  const query = [slug ? `slug=${encodeURIComponent(slug)}` : "", mediaType ? `type=${encodeURIComponent(mediaType)}` : ""]
    .filter(Boolean)
    .join("&");
  if (source) {
    return `/anime/${encodeURIComponent(source)}/${encodeURIComponent(animeId)}${query ? `?${query}` : ""}`;
  }
  return `/anime/${encodeURIComponent(animeId)}${query ? `?${query}` : ""}`;
}

function stripResize(url) {
  const src = toSafeText(url).trim();
  if (!src) return "";
  try {
    const parsed = new URL(src);
    ["resize", "w", "h", "width", "height", "fit", "q", "quality"].forEach((k) => parsed.searchParams.delete(k));
    parsed.pathname = parsed.pathname.replace(/-\d{2,4}x\d{2,4}(?=\.(jpg|jpeg|png|webp|gif)$)/i, "");
    return parsed.toString();
  } catch {
    return src;
  }
}

function toWeserv(url, w = 600, h = 900) {
  const src = toSafeText(url).trim();
  if (!src) return "";
  const normalized = src.replace(/^https?:\/\//i, "");
  return `https://images.weserv.nl/?url=${encodeURIComponent(normalized)}&w=${w}&h=${h}&fit=cover`;
}

function buildImageCandidates(primary, raw) {
  const a = toSafeText(primary).trim();
  const b = toSafeText(raw).trim();
  const base = [a, b, stripResize(a), stripResize(b)].filter(Boolean);
  const proxied = base.flatMap((url) => [toWeserv(url, 600, 900), toWeserv(url, 720, 1080)]);
  return Array.from(new Set([...base, ...proxied].filter(Boolean)));
}

export default function AnimeCard({ anime }) {
  const rawType = toSafeText(anime?.type, "").toLowerCase();
  const mediaType = ["manga", "manhwa", "manhua", "novel"].includes(rawType) ? rawType : "manga";
  const title = toSafeText(anime?.title, toSafeText(anime?.name, "Untitled Comic"));
  const primaryPoster = toSafeText(anime?.poster, toSafeText(anime?.thumbnail, toSafeText(anime?.image, "")));
  const rawPoster = toSafeText(anime?.posterRaw, "");

  const candidates = useMemo(() => buildImageCandidates(primaryPoster, rawPoster), [primaryPoster, rawPoster]);
  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    setImgIndex(0);
  }, [candidates.length, primaryPoster, rawPoster]);

  const activePoster = candidates[imgIndex] || "";
  const detailPath = toAnimePath(anime);

  return (
    <Link
      to={detailPath}
      className="group w-36 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-emerald-900/80 transition duration-300 hover:-translate-y-1 hover:border-emerald-300/50 sm:w-40 md:w-44 lg:w-52"
    >
      <div className="relative aspect-[3/4] w-full bg-emerald-800">
        {activePoster ? (
          <img
            src={activePoster}
            alt={title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => {
              setImgIndex((prev) => (prev + 1 < candidates.length ? prev + 1 : prev));
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-4 text-center">
            <p className="line-clamp-5 text-sm font-semibold leading-relaxed text-slate-100">{title}</p>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
        <p className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
          {mediaType}
        </p>
      </div>
      <div className="p-2.5 sm:p-3">
        <p className="line-clamp-2 text-sm font-semibold text-slate-100">{title}</p>
      </div>
    </Link>
  );
}
