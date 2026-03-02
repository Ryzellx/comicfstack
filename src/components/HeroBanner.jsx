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

function toWeserv(url, w = 1200, h = 700) {
  const src = toSafeText(url).trim();
  if (!src) return "";
  const normalized = src.replace(/^https?:\/\//i, "");
  return `https://images.weserv.nl/?url=${encodeURIComponent(normalized)}&w=${w}&h=${h}&fit=cover`;
}

function buildImageCandidates(primary, raw) {
  const a = toSafeText(primary).trim();
  const b = toSafeText(raw).trim();
  const base = [a, b, stripResize(a), stripResize(b)].filter(Boolean);
  const proxied = base.flatMap((url) => [toWeserv(url, 1200, 700), toWeserv(url, 1400, 800)]);
  return Array.from(new Set([...base, ...proxied].filter(Boolean)));
}

export default function HeroBanner({ anime }) {
  const title = toSafeText(anime?.title, toSafeText(anime?.name, "Welcome to Zetoon"));
  const itemId = anime?.animeId || anime?.id || "";
  const primaryImage = toSafeText(anime?.poster, toSafeText(anime?.thumbnail, toSafeText(anime?.image, "")));
  const rawImage = toSafeText(anime?.posterRaw, "");

  const candidates = useMemo(() => buildImageCandidates(primaryImage, rawImage), [primaryImage, rawImage]);
  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    setImgIndex(0);
  }, [candidates.length, primaryImage, rawImage]);

  const image = candidates[imgIndex] || "";
  const detailPath = toAnimePath(anime);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-emerald-900/70 animate-fade-in">
      {image ? (
        <img
          src={image}
          alt={title}
          className="h-56 w-full object-cover opacity-60 sm:h-72 lg:h-96"
          referrerPolicy="no-referrer"
          onError={() => {
            setImgIndex((prev) => (prev + 1 < candidates.length ? prev + 1 : prev));
          }}
        />
      ) : (
        <div className="h-56 w-full bg-gradient-to-r from-slate-950 via-slate-800 to-slate-900 sm:h-72 lg:h-96" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/75 to-slate-950/30" />
      <div className="absolute inset-0 flex max-w-3xl flex-col justify-end p-4 sm:p-6 lg:p-8">
        <p className="mb-2 inline-flex w-fit rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-200">
          Featured Pick
        </p>
        <h1 className="font-heading text-2xl font-bold text-white sm:text-4xl lg:text-5xl">{title}</h1>
        {itemId ? (
          <Link
            to={detailPath}
            className="mt-5 inline-flex w-fit rounded-full bg-gradient-to-r from-lime-300 to-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Lihat Detail
          </Link>
        ) : null}
      </div>
    </section>
  );
}
