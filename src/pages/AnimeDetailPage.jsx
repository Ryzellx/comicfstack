import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ANIME_PROVIDER,
  api,
  extractEpisodeList,
  extractObject,
  extractRecommendationList,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";

function getEpisodeNumber(episode) {
  const num = Number(episode?.number);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function sortEpisodesDescending(list = []) {
  return [...list].sort((a, b) => {
    const aNum = getEpisodeNumber(a);
    const bNum = getEpisodeNumber(b);
    if (aNum && bNum) return bNum - aNum;
    if (aNum) return -1;
    if (bNum) return 1;
    return String(b?.title || "").localeCompare(String(a?.title || ""), "id", { sensitivity: "base" });
  });
}

export default function AnimeDetailPage() {
  const { watchlist, addToWatchlist, removeFromWatchlist, watchedEpisodes } = useAuth();
  const { animeId, source } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const slug = searchParams.get("slug") || "";
  const typeFromQuery = String(searchParams.get("type") || "").toLowerCase();
  const comicSource = source || ANIME_PROVIDER;

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState({});
  const [episodes, setEpisodes] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError("");

        const target = slug || animeId;
        const [detailRes, episodesRes, recRes] = await Promise.allSettled([
          api.getAnimeDetail(target, { source: comicSource }),
          api.getAnimeEpisodes(target, { source: comicSource }),
          api.getAnimeRecommendations(target, { source: comicSource }),
        ]);

        if (!active) return;

        const normalizedDetail =
          detailRes.status === "fulfilled"
            ? extractObject(detailRes.value, "anime")
            : {
                animeId,
                title: String(animeId || "").replace(/[-_]+/g, " ").trim() || animeId,
                source: comicSource,
                synopsis: "",
              };

        const parsedEpisodes = episodesRes.status === "fulfilled" ? extractEpisodeList(episodesRes.value) : [];

        setDetail(normalizedDetail);
        setEpisodes(sortEpisodesDescending(parsedEpisodes));
        setRecommendations(recRes.status === "fulfilled" ? extractRecommendationList(recRes.value, "anime") : []);
      } catch (err) {
        setError(err.message || "Gagal load detail komik.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [animeId, comicSource, slug]);

  const synopsisText = useMemo(() => detail.synopsis || "Sinopsis belum tersedia.", [detail]);
  const animeSlug = detail.animeSlug || slug || animeId;
  const detailMediaType = useMemo(() => {
    const fromDetailType = String(detail?.type || "").toLowerCase();
    if (["manga", "manhwa", "manhua", "novel"].includes(fromDetailType)) return fromDetailType;
    const fromDetailMedia = String(detail?.mediaType || "").toLowerCase();
    if (["manga", "manhwa", "manhua", "novel"].includes(fromDetailMedia)) return fromDetailMedia;
    if (["manga", "manhwa", "manhua", "novel"].includes(typeFromQuery)) return typeFromQuery;
    return comicSource === "sakuranovel" ? "novel" : "";
  }, [detail?.type, detail?.mediaType, typeFromQuery, comicSource]);
  const inWatchlist = useMemo(
    () => watchlist.some((item) => String(item?.animeId) === String(detail.animeId || animeId)),
    [watchlist, detail.animeId, animeId]
  );

  const watchedKeys = useMemo(() => {
    const key = String(detail.animeId || animeId);
    const list = watchedEpisodes?.[key];
    return new Set(Array.isArray(list) ? list.map((item) => String(item)) : []);
  }, [watchedEpisodes, detail.animeId, animeId]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-emerald-300" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
      >
        Kembali
      </button>

      <div className="grid gap-6 rounded-3xl border border-white/10 bg-emerald-900/60 p-4 md:grid-cols-[220px,1fr]">
        <div className="overflow-hidden rounded-2xl bg-emerald-800">
          {detail.poster ? (
            <img src={detail.poster} alt={detail.title || "Komik"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-72 items-center justify-center p-4 text-center">
              <p className="line-clamp-6 text-base font-semibold text-slate-100">{detail.title || animeId}</p>
            </div>
          )}
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">{detail.title || animeId}</h1>
          <p className="mt-2 text-sm text-emerald-100 whitespace-pre-line">{synopsisText}</p>

          <div className="mt-4 grid gap-2 text-xs text-emerald-100 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">Status: {detail.status || "Unknown"}</div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">Chapters: {episodes.length || detail.episodes || "?"}</div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">Source: {comicSource === "sakuranovel" ? "SakuraNovel" : "BacaKomik"}</div>
          </div>

          {episodes[0]?.episodeId ? (
            <Link
              to={`/watch/${encodeURIComponent(comicSource)}/${encodeURIComponent(detail.animeId || animeId)}?slug=${encodeURIComponent(
                animeSlug
              )}&chapter=${encodeURIComponent(episodes[0].episodeId)}${detailMediaType ? `&type=${encodeURIComponent(detailMediaType)}` : ""}`}
              className="mt-4 inline-flex rounded-full bg-gradient-to-r from-lime-300 to-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Baca Chapter Terbaru
            </Link>
          ) : null}

          <button
            type="button"
            onClick={() => {
              if (inWatchlist) {
                removeFromWatchlist(detail.animeId || animeId);
                return;
              }
              addToWatchlist({
                animeId: detail.animeId || animeId,
                title: detail.title || animeId,
                poster: detail.poster || "",
                source: comicSource,
                slug: animeSlug,
              });
            }}
            className="ml-2 mt-4 inline-flex rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            {inWatchlist ? "Hapus ReadList" : "Tambah ReadList"}
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-emerald-900/60 p-4">
        <h2 className="font-heading text-xl font-bold text-white">Daftar Chapter</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {episodes.map((episode) => (
            <Link
              key={episode.id || episode.title}
              to={`/watch/${encodeURIComponent(comicSource)}/${encodeURIComponent(detail.animeId || animeId)}?slug=${encodeURIComponent(
                animeSlug
              )}&chapter=${encodeURIComponent(episode.episodeId || "")}${detailMediaType ? `&type=${encodeURIComponent(detailMediaType)}` : ""}`}
              className={`rounded-xl border px-3 py-2 text-sm transition hover:border-emerald-300/60 ${
                watchedKeys.has(String(episode.episodeId || episode.number || ""))
                  ? "border-white/10 bg-emerald-950/40 text-emerald-300"
                  : "border-white/10 bg-emerald-950 text-white"
              }`}
            >
              <p>{episode.title}</p>
              <p className="mt-0.5 text-xs text-emerald-200">Rilis {episode.releaseText || "waktu belum tersedia"}</p>
            </Link>
          ))}
          {episodes.length === 0 ? <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">Daftar chapter belum tersedia.</div> : null}
        </div>
      </div>

      {recommendations.length > 0 ? (
        <div className="rounded-3xl border border-white/10 bg-emerald-900/60 p-4">
          <h2 className="font-heading text-xl font-bold text-white">Rekomendasi</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {recommendations.slice(0, 10).map((item) => (
              <Link
                key={item.animeId}
                to={`/anime/${encodeURIComponent(item.source || comicSource)}/${encodeURIComponent(item.animeId)}${
                  item.animeSlug ? `?slug=${encodeURIComponent(item.animeSlug)}` : ""
                }`}
                className="rounded-xl border border-white/10 bg-black/20 p-2"
              >
                {item.poster ? <img src={item.poster} alt={item.title} className="aspect-[3/4] w-full rounded-lg object-cover" /> : null}
                <p className="mt-2 line-clamp-2 text-xs font-semibold text-white">{item.title}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

