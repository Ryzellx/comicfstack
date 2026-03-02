import AnimeCard from "./AnimeCard";

export default function HorizontalRail({ title, items }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <section className="animate-slide-up">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="font-heading text-xl font-bold text-white">{title}</h2>
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">{items.length} titles</p>
      </div>
      <div className="horizontal-rail flex gap-3 pb-3 sm:gap-4">
        {items.map((anime) => (
          <AnimeCard key={`${anime?.mediaType || "anime"}-${anime?.animeId || anime?.mangaId || anime?.id || anime?.title}`} anime={anime} />
        ))}
      </div>
    </section>
  );
}
