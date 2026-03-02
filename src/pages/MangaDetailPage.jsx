import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  extractCharacterList,
  extractObject,
  extractRecommendationList,
} from "../lib/api";

export default function MangaDetailPage() {
  const { mangaId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState({});
  const [characters, setCharacters] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError("");

        const [detailRes, charsRes, recRes] = await Promise.allSettled([
          api.getMangaDetail(mangaId),
          api.getMangaCharacters(mangaId),
          api.getMangaRecommendations(mangaId),
        ]);

        if (!active) return;

        if (detailRes.status === "rejected") {
          throw new Error("Gagal load detail manga.");
        }

        setDetail(extractObject(detailRes.value, "manga"));
        setCharacters(charsRes.status === "fulfilled" ? extractCharacterList(charsRes.value) : []);
        setRecommendations(recRes.status === "fulfilled" ? extractRecommendationList(recRes.value, "manga") : []);
      } catch (err) {
        setError(err.message || "Gagal load manga detail.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [mangaId]);

  const synopsis = useMemo(() => detail.synopsis || "No synopsis available.", [detail]);
  const readUrl = detail?.url || "";

  if (loading) return <p className="text-sm text-emerald-200">Loading manga detail...</p>;

  return (
    <section className="space-y-6">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="grid gap-6 rounded-3xl border border-white/10 bg-emerald-900/60 p-4 md:grid-cols-[220px,1fr]">
        <div className="overflow-hidden rounded-2xl bg-emerald-800">
          {detail.poster ? <img src={detail.poster} alt={detail.title || "Manga"} className="h-full w-full object-cover" /> : null}
        </div>

        <div>
          <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">{detail.title || mangaId}</h1>
          <p className="mt-2 text-sm text-emerald-100">{synopsis}</p>

          <div className="mt-4 grid gap-2 text-xs text-emerald-100 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">Status: {detail.status || "Unknown"}</div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">Chapters: {detail.chapters || "?"}</div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">Score: {detail.score || "N/A"}</div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2">Rank: #{detail.rank || "-"}</div>
          </div>

          {readUrl ? (
            <a
              href={readUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-full bg-gradient-to-r from-lime-300 to-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Baca Manga
            </a>
          ) : (
            <p className="mt-4 text-xs text-emerald-200">Link baca belum tersedia untuk manga ini.</p>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-emerald-900/60 p-4">
        <h2 className="font-heading text-xl font-bold text-white">Characters</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {characters.slice(0, 12).map((character) => (
            <div key={character.id} className="rounded-2xl border border-white/10 bg-black/20 p-2">
              {character.image ? (
                <img src={character.image} alt={character.name} className="aspect-[3/4] w-full rounded-lg object-cover" />
              ) : null}
              <p className="mt-2 line-clamp-2 text-xs font-semibold text-white">{character.name}</p>
              <p className="text-[11px] text-emerald-200">{character.role || "Character"}</p>
            </div>
          ))}
        </div>
      </div>

      {recommendations.length > 0 ? (
        <div className="rounded-3xl border border-white/10 bg-emerald-900/60 p-4">
          <h2 className="font-heading text-xl font-bold text-white">Recommendations</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {recommendations.slice(0, 10).map((item) => (
              <Link key={item.mangaId} to={`/manga/${item.mangaId}`} className="rounded-xl border border-white/10 bg-black/20 p-2">
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
