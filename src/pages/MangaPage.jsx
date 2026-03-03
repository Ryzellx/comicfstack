import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, extractMangaList } from "../lib/api";

export default function MangaPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const payload = await api.getTopManga(1);
        if (!active) return;
        setItems(extractMangaList(payload));
      } catch (err) {
        setError(err.message || "Gagal load top manga.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const onSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) {
      setHasSearched(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setHasSearched(true);
      const payload = await api.searchManga(query.trim(), 1);
      setItems(extractMangaList(payload));
    } catch (err) {
      setError(err.message || "Gagal mencari manga.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-pink-900/30 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Manga Explorer</p>
        <h1 className="mt-1 font-heading text-3xl font-bold text-white">Temukan Manga Terbaik</h1>
        <p className="mt-2 text-sm text-emerald-100">Koleksi manga populer dan hasil pencarian terbaru.</p>

        <form onSubmit={onSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            className="w-full rounded-xl border border-white/15 bg-emerald-900/80 px-4 py-3 text-sm outline-none transition focus:border-emerald-300/60"
            placeholder="Cari manga..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-lime-300 to-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Search
          </button>
        </form>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {loading ? <p className="text-sm text-emerald-200">Loading manga list...</p> : null}
      {!loading && !error && hasSearched && items.length === 0 ? <p className="text-sm text-amber-200">Judul tidak ada.</p> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((item, index) => (
          <Link
            key={item.mangaId}
            to={`/manga/${item.mangaId}`}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-emerald-900/70 transition hover:-translate-y-1 hover:border-emerald-300/50"
            style={{ animation: `slideUp 380ms ease-out ${index * 25}ms both` }}
          >
            {item.poster ? <img src={item.poster} alt={item.title} className="aspect-[3/4] w-full object-cover" /> : null}
            <div className="p-3">
              <p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-xs text-pink-200/90">{item.episodesText}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
