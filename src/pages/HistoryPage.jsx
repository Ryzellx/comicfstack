import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const TYPE_ORDER = ["manga", "manhwa", "manhua", "novel"];
const TYPE_LABELS = {
  manga: "Manga",
  manhwa: "Manhwa",
  manhua: "Manhua",
  novel: "Novel",
  other: "Lainnya",
};

function toSafeText(value, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function normalizeType(item) {
  const type = String(item?.mediaType || item?.type || "").trim().toLowerCase();
  if (TYPE_ORDER.includes(type)) return type;
  const source = String(item?.source || "").toLowerCase();
  if (source === "sakuranovel") return "novel";
  return "manga";
}

function normalizeSource(item) {
  const source = toSafeText(item?.source).trim().toLowerCase();
  if (source === "bacakomik" || source === "sakuranovel") return source;
  return normalizeType(item) === "novel" ? "sakuranovel" : "bacakomik";
}

function toRelativeTimeId(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "waktu tidak diketahui";

  const diffMs = Date.now() - date.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 60 * 1000) return "baru saja";

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const monthMs = 30 * dayMs;

  if (diffMs < hourMs) {
    const minutes = Math.floor(diffMs / minuteMs);
    return `${minutes} menit lalu`;
  }
  if (diffMs < dayMs) {
    const hours = Math.floor(diffMs / hourMs);
    return `${hours} jam lalu`;
  }
  if (diffMs < monthMs) {
    const days = Math.floor(diffMs / dayMs);
    return `${days} hari lalu`;
  }
  const months = Math.floor(diffMs / monthMs);
  return `${months} bulan lalu`;
}

export default function HistoryPage() {
  const { watchHistory } = useAuth();
  const safeHistory = (Array.isArray(watchHistory) ? watchHistory : []).filter(
    (item) => item && typeof item === "object" && String(item?.animeId || "").trim()
  );

  const grouped = safeHistory.reduce(
    (acc, item) => {
      const type = normalizeType(item);
      if (!acc[type]) acc[type] = [];
      acc[type].push(item);
      return acc;
    },
    { manga: [], manhwa: [], manhua: [], novel: [], other: [] }
  );

  const sections = [...TYPE_ORDER, "other"].filter((type) => grouped[type]?.length > 0);

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-emerald-900/60 p-5">
        <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">Riwayat Baca</h1>
        <p className="mt-1 text-sm text-emerald-100">Riwayat dipisah per kategori agar tidak tercampur.</p>
      </div>

      {safeHistory.length === 0 ? (
        <p className="text-sm text-emerald-200">Belum ada riwayat baca.</p>
      ) : (
        <div className="space-y-6">
          {sections.map((type) => (
            <section key={type} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-xl font-bold text-white">{TYPE_LABELS[type] || TYPE_LABELS.other}</h2>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                  {grouped[type].length} item
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[type].map((item) => {
                  const source = normalizeSource(item);
                  const slug = toSafeText(item?.slug).trim();
                  const safeSlug = slug && slug !== "undefined" && slug !== "null" ? slug : "";
                  const chapter = toSafeText(item?.episodeId).trim();
                  const mediaType = normalizeType(item);
                  const query = [
                    safeSlug ? `slug=${encodeURIComponent(safeSlug)}` : "",
                    chapter ? `chapter=${encodeURIComponent(chapter)}` : "",
                    mediaType ? `type=${encodeURIComponent(mediaType)}` : "",
                  ]
                    .filter(Boolean)
                    .join("&");
                  const target = `/watch/${encodeURIComponent(source)}/${encodeURIComponent(String(item.animeId))}${
                    query ? `?${query}` : ""
                  }`;

                  return (
                    <Link
                      key={item.id}
                      to={target}
                      className="rounded-2xl border border-white/10 bg-emerald-900/70 p-3 transition hover:border-emerald-300/60"
                    >
                      <div className="flex gap-3">
                        <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-emerald-800">
                          {item.poster ? <img src={item.poster} alt={item.title} className="h-full w-full object-cover" /> : null}
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
                          <p className="mt-1 text-xs text-emerald-200">{item.episodeTitle || `Chapter ${item.episodeNumber || "?"}`}</p>
                          <p className="mt-1 text-[11px] text-emerald-200">Dibuka {toRelativeTimeId(item.watchedAt)}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
