import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function WatchlistPage() {
  const { watchlist, removeFromWatchlist } = useAuth();

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-emerald-900/60 p-4 sm:p-5">
        <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">ReadList</h1>
        <p className="mt-1 text-sm text-emerald-100">Daftar komik yang kamu simpan untuk dibaca nanti.</p>
      </div>

      {watchlist.length === 0 ? (
        <p className="text-sm text-emerald-200">ReadList masih kosong.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          {watchlist.map((item) => (
            <div
              key={`${item.animeId}-${item.addedAt}`}
              className="rounded-xl border border-white/10 bg-emerald-900/70 p-2.5 sm:rounded-2xl sm:p-3"
            >
              <Link
                to={`/anime/${encodeURIComponent(item.source || "bacakomik")}/${encodeURIComponent(item.animeId)}${
                  item.slug ? `?slug=${encodeURIComponent(item.slug)}` : ""
                }`}
                className="block"
              >
                <div className="overflow-hidden rounded-lg bg-emerald-800">
                  {item.poster ? <img src={item.poster} alt={item.title} className="aspect-[3/4] w-full object-cover" /> : null}
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug text-white sm:mt-2 sm:text-sm">
                  {item.title}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => removeFromWatchlist(item.animeId)}
                className="mt-2 w-full rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-2 py-1.5 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-400/20 sm:mt-3 sm:px-3 sm:py-2 sm:text-xs"
              >
                Hapus
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
