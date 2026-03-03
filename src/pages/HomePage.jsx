import { useEffect, useMemo, useState } from "react";
import HeroBanner from "../components/HeroBanner";
import HorizontalRail from "../components/HorizontalRail";
import { api, extractGenreList, extractHomeLists, extractList, extractNovelList } from "../lib/api";

const SEARCH_HISTORY_KEY = "zetoon_search_history_v1";
const SEARCH_HISTORY_LIMIT = 12;
const TYPE_OPTIONS = [
  { key: "manga", label: "Manga" },
  { key: "manhwa", label: "Manhwa" },
  { key: "manhua", label: "Manhua" },
  { key: "novel", label: "Novel" },
];

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a, b) {
  const left = normalizeSearchText(a);
  const right = normalizeSearchText(b);
  const rows = left.length + 1;
  const cols = right.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[rows - 1][cols - 1];
}

function pickBestCorrection(query, items = []) {
  const base = normalizeSearchText(query);
  if (!base || !Array.isArray(items) || items.length === 0) return "";

  let best = "";
  let bestScore = Number.POSITIVE_INFINITY;

  items.forEach((item) => {
    const candidate = String(item || "").trim();
    if (!candidate) return;
    const normalizedCandidate = normalizeSearchText(candidate);
    if (!normalizedCandidate || normalizedCandidate === base) return;
    const dist = levenshteinDistance(base, normalizedCandidate);
    const maxLen = Math.max(base.length, normalizedCandidate.length, 1);
    const ratio = dist / maxLen;
    if (ratio < bestScore) {
      bestScore = ratio;
      best = candidate;
    }
  });

  return bestScore <= 0.45 ? best : "";
}

function normalizeType(value) {
  return String(value || "").trim().toLowerCase();
}

function toLocationLabel(timeZone) {
  const zone = String(timeZone || "Asia/Jakarta").trim();
  const city = zone.split("/").pop()?.replace(/_/g, " ") || zone;
  return `${city} (${zone})`;
}

function filterByType(list = [], activeType = "all") {
  return (Array.isArray(list) ? list : []).filter((item) => normalizeType(item?.type) === activeType);
}

function filterByTypeLoose(list = [], activeType = "all") {
  if (activeType === "all") return Array.isArray(list) ? list : [];
  return (Array.isArray(list) ? list : []).filter((item) => {
    const type = normalizeType(item?.type);
    if (!type) return true;
    return type === activeType;
  });
}

function filterByQuery(list = [], query = "") {
  const q = normalizeSearchText(query);
  if (!q) return Array.isArray(list) ? list : [];
  const tokens = q.split(" ").filter(Boolean);

  return (Array.isArray(list) ? list : []).filter((item) => {
    const hay = normalizeSearchText(
      `${item?.title || ""} ${item?.name || ""} ${item?.headline || ""} ${item?.synopsis || ""}`
    );
    if (!hay) return false;
    if (hay.includes(q)) return true;
    return tokens.some((token) => hay.includes(token));
  });
}

function createEmptyHistoryByType() {
  return {
    manga: [],
    manhwa: [],
    manhua: [],
    novel: [],
  };
}

function readHistoryByType() {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    // migrate old array format to manga bucket
    if (Array.isArray(parsed)) {
      return {
        ...createEmptyHistoryByType(),
        manga: parsed.filter(Boolean).slice(0, SEARCH_HISTORY_LIMIT),
      };
    }

    if (!parsed || typeof parsed !== "object") return createEmptyHistoryByType();
    return {
      manga: Array.isArray(parsed?.manga) ? parsed.manga.filter(Boolean).slice(0, SEARCH_HISTORY_LIMIT) : [],
      manhwa: Array.isArray(parsed?.manhwa) ? parsed.manhwa.filter(Boolean).slice(0, SEARCH_HISTORY_LIMIT) : [],
      manhua: Array.isArray(parsed?.manhua) ? parsed.manhua.filter(Boolean).slice(0, SEARCH_HISTORY_LIMIT) : [],
      novel: Array.isArray(parsed?.novel) ? parsed.novel.filter(Boolean).slice(0, SEARCH_HISTORY_LIMIT) : [],
    };
  } catch {
    return createEmptyHistoryByType();
  }
}

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [home, setHome] = useState({
    spotlight: [],
    trending: [],
    latestEpisodes: [],
    topAiring: [],
    mostPopular: [],
    latestCompleted: [],
    topUpcoming: [],
  });
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [searchHistoryByType, setSearchHistoryByType] = useState(createEmptyHistoryByType);
  const [searchCorrection, setSearchCorrection] = useState("");
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState("");
  const [genreItems, setGenreItems] = useState([]);
  const [genreLoading, setGenreLoading] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [activeType, setActiveType] = useState("manga");
  const [typeItems, setTypeItems] = useState([]);
  const [typeLoading, setTypeLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [residentTimeZone, setResidentTimeZone] = useState("Asia/Jakarta");
  const isNovelActive = activeType === "novel";

  useEffect(() => {
    try {
      const resolvedZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (resolvedZone) setResidentTimeZone(resolvedZone);
    } catch {
      setResidentTimeZone("Asia/Jakarta");
    }
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loaded = readHistoryByType();
    setSearchHistoryByType(loaded);
    setSearchHistory(Array.isArray(loaded?.manga) ? loaded.manga : []);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const [homePayload, genrePayload] = await Promise.allSettled([api.getHome(), api.getGenres()]);
        if (!active) return;
        setHome(extractHomeLists(homePayload.status === "fulfilled" ? homePayload.value : {}));
        const parsedGenres = extractGenreList(genrePayload.status === "fulfilled" ? genrePayload.value : {});
        setGenres(parsedGenres);
        if (parsedGenres.length > 0) setSelectedGenre(parsedGenres[0].slug);
      } catch (err) {
        if (!active) return;
        setError(err.message || "Gagal load homepage komik.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!selectedGenre) {
      setGenreItems([]);
      return undefined;
    }

    (async () => {
      try {
        setGenreLoading(true);
        const payload = isNovelActive ? await api.getNovelByGenre(selectedGenre) : await api.getGenreAnime(selectedGenre, 1);
        if (!active) return;
        const list = isNovelActive ? extractNovelList(payload) : extractList(payload);
        setGenreItems(list.slice(0, 18));
      } catch {
        if (!active) return;
        setGenreItems([]);
      } finally {
        if (active) setGenreLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedGenre, isNovelActive]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const payload = isNovelActive ? await api.getNovelGenres() : await api.getGenres();
        if (!active) return;
        const parsedGenres = extractGenreList(payload);
        setGenres(parsedGenres);
        setSelectedGenre(parsedGenres[0]?.slug || "");
      } catch {
        if (!active) return;
        setGenres([]);
        setSelectedGenre("");
      }
    })();

    return () => {
      active = false;
    };
  }, [isNovelActive]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setTypeLoading(true);
        const payload = isNovelActive ? await api.getNovelHome() : await api.getKomikByType(activeType);
        if (!active) return;
        if (isNovelActive) {
          setTypeItems(extractNovelList(payload).slice(0, 24));
        } else {
          setTypeItems(filterByType(extractList(payload), activeType).slice(0, 24));
        }
      } catch {
        if (!active) return;
        setTypeItems([]);
      } finally {
        if (active) setTypeLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [activeType, isNovelActive]);

  useEffect(() => {
    setSearchHistory(Array.isArray(searchHistoryByType?.[activeType]) ? searchHistoryByType[activeType] : []);
  }, [activeType, searchHistoryByType]);

  useEffect(() => {
    setQuery("");
    setSearchResults([]);
    setSearchCorrection("");
    setHasSearched(false);
  }, [activeType]);

  const scopedHome = useMemo(
    () => ({
      spotlight: filterByType(home.spotlight, activeType),
      trending: filterByType(home.trending, activeType),
      latestEpisodes: filterByType(home.latestEpisodes, activeType),
      topAiring: filterByType(home.topAiring, activeType),
      mostPopular: filterByType(home.mostPopular, activeType),
      latestCompleted: filterByType(home.latestCompleted, activeType),
      topUpcoming: filterByType(home.topUpcoming, activeType),
    }),
    [home, activeType]
  );

  const featuredPool = useMemo(() => {
    if (isNovelActive) {
      return typeItems.slice(0, 12);
    }
    const merged = [
      ...(Array.isArray(scopedHome.spotlight) ? scopedHome.spotlight : []),
      ...(Array.isArray(scopedHome.trending) ? scopedHome.trending : []),
      ...(Array.isArray(scopedHome.latestEpisodes) ? scopedHome.latestEpisodes : []),
    ];
    const seen = new Set();
    return merged.filter((item) => {
      const id = String(item?.animeId || item?.id || item?.title || "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [isNovelActive, typeItems, scopedHome.spotlight, scopedHome.trending, scopedHome.latestEpisodes]);

  useEffect(() => {
    setFeaturedIndex(0);
  }, [featuredPool.length]);

  useEffect(() => {
    if (featuredPool.length <= 1) return undefined;
    const timer = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % featuredPool.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [featuredPool.length]);

  const featured = useMemo(
    () =>
      featuredPool[featuredIndex] ||
      scopedHome.topAiring?.[0] ||
      scopedHome.mostPopular?.[0] ||
      scopedHome.latestEpisodes?.[0] ||
      null,
    [featuredPool, featuredIndex, scopedHome.topAiring, scopedHome.mostPopular, scopedHome.latestEpisodes]
  );

  const filteredHistory = useMemo(() => {
    const q = normalizeSearchText(query);
    if (!q) return searchHistory.slice(0, 6);
    return searchHistory.filter((item) => normalizeSearchText(item).includes(q)).slice(0, 6);
  }, [searchHistory, query]);

  const liveDate = useMemo(
    () =>
      new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(now),
    [now]
  );

  const liveTime = useMemo(
    () =>
      new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: residentTimeZone,
      }).format(now),
    [now, residentTimeZone]
  );

  const liveLocation = useMemo(() => toLocationLabel(residentTimeZone), [residentTimeZone]);

  const writeSearchHistory = (value) => {
    const cleaned = String(value || "").trim();
    if (!cleaned) return;
    setSearchHistoryByType((prevMap) => {
      const safeMap = prevMap && typeof prevMap === "object" ? prevMap : createEmptyHistoryByType();
      const currentList = Array.isArray(safeMap[activeType]) ? safeMap[activeType] : [];
      const nextList = [cleaned, ...currentList.filter((item) => normalizeSearchText(item) !== normalizeSearchText(cleaned))].slice(
        0,
        SEARCH_HISTORY_LIMIT
      );
      const nextMap = { ...safeMap, [activeType]: nextList };
      setSearchHistory(nextList);
      try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(nextMap));
      } catch {
        // ignore storage failures
      }
      return nextMap;
    });
  };

  const runSearch = async (rawQuery) => {
    const cleaned = String(rawQuery || "").trim();
    if (!cleaned) {
      setSearchResults([]);
      setSearchCorrection("");
      setHasSearched(false);
      return;
    }

    try {
      setError("");
      setSearchCorrection("");
      setHasSearched(true);
      let list = [];
      if (isNovelActive) {
        const searchPayload = await api.searchNovel(cleaned);
        list = filterByQuery(extractNovelList(searchPayload), cleaned);
        if (list.length === 0) {
          const homePayload = await api.getNovelHome();
          list = filterByQuery(extractNovelList(homePayload), cleaned);
        }
      } else {
        const searchPayload = await api.searchAnime(cleaned);
        const searchList = filterByQuery(extractList(searchPayload), cleaned);
        list = filterByTypeLoose(searchList, activeType);

        if (list.length === 0) {
          const typePayload = await api.getKomikByType(activeType);
          const typeList = extractList(typePayload);
          list = filterByQuery(typeList, cleaned);
        }
      }

      setSearchResults(list);
      writeSearchHistory(cleaned);

      if (list.length > 0) {
        const localCorrection = pickBestCorrection(
          cleaned,
          list.map((item) => item?.title || item?.headline || "")
        );
        if (localCorrection) setSearchCorrection(localCorrection);
      }
    } catch (err) {
      setError(err.message || `Search ${isNovelActive ? "novel" : "komik"} gagal.`);
      setSearchResults([]);
      setSearchCorrection("");
    }
  };

  const onSearch = async (e) => {
    e.preventDefault();
    await runSearch(query);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-emerald-300"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-3xl border border-emerald-200/15 bg-gradient-to-br from-emerald-900/45 via-emerald-900/30 to-teal-950/55 p-3 pb-4 sm:space-y-8 sm:p-4">
      <section className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-200">Tanggal</p>
          <p className="mt-1 text-base font-semibold text-white sm:text-lg">{liveDate}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-200">Jam</p>
          <p className="mt-1 text-base font-semibold text-amber-300 sm:text-lg">{liveTime}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-200">Provider</p>
          <p className="mt-1 text-base font-semibold text-emerald-200 sm:text-lg">Zetoon</p>
        </div>
      </section>

      <div key={`featured-${featured?.animeId || featured?.id || featuredIndex}`}>
        <HeroBanner anime={featured} />
      </div>

      <section className="rounded-3xl border border-white/10 bg-emerald-900/50 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveType(item.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                activeType === item.key
                  ? "bg-emerald-300 text-emerald-950"
                  : "border border-white/15 bg-white/5 text-emerald-100 hover:border-emerald-300/50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <form onSubmit={onSearch} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="w-full rounded-xl border border-white/15 bg-emerald-900/80 px-4 py-3 text-sm outline-none transition focus:border-emerald-300/60"
            placeholder={`Cari ${activeType}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-lime-300 to-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto"
          >
            Search
          </button>
        </form>
        {filteredHistory.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-emerald-200">Riwayat</span>
            {filteredHistory.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setQuery(item);
                  runSearch(item);
                }}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:border-emerald-300/50 hover:text-white"
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
        {searchCorrection ? (
          <p className="mt-3 text-xs text-amber-300">
            Mungkin maksud kamu:{" "}
            <button
              type="button"
              className="font-semibold underline underline-offset-2"
              onClick={() => {
                setQuery(searchCorrection);
                runSearch(searchCorrection);
              }}
            >
              {searchCorrection}
            </button>
          </p>
        ) : null}
      </section>

  {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {searchResults.length > 0 ? (
        <HorizontalRail
          title={`Hasil Pencarian ${activeType.toUpperCase()}`}
          items={searchResults}
        />
      ) : null}
      {!error && hasSearched && searchResults.length === 0 ? (
        <p className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Judul tidak ada.
        </p>
      ) : null}

      <HorizontalRail
        title={`Kategori ${activeType.toUpperCase()}`}
        items={typeItems}
      />

      {genres.length > 0 ? (
        <section className="rounded-3xl border border-white/10 bg-emerald-900/50 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-heading text-xl font-bold text-white">Pilih Genre</h2>
            <div className="flex items-center gap-3">
              {typeLoading ? <p className="text-xs text-emerald-200">Loading type...</p> : null}
              {genreLoading ? <p className="text-xs text-emerald-200">Loading genre...</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {genres.slice(0, 24).map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => setSelectedGenre(item.slug)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  selectedGenre === item.slug
                    ? "bg-emerald-300 text-emerald-950"
                    : "border border-white/15 bg-white/5 text-emerald-100 hover:border-emerald-300/50"
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {selectedGenre && genreItems.length > 0 ? (
        <HorizontalRail
          title={`Genre: ${genres.find((item) => item.slug === selectedGenre)?.name || selectedGenre}`}
          items={isNovelActive ? genreItems : filterByType(genreItems, activeType)}
        />
      ) : null}

      {!isNovelActive ? (
        <>
          <HorizontalRail title="Komik Terbaru" items={scopedHome.latestEpisodes} />
          <HorizontalRail title="Komik Populer" items={scopedHome.mostPopular} />
          <HorizontalRail title="Rekomendasi" items={scopedHome.spotlight} />
          <HorizontalRail title="Top Komik" items={scopedHome.trending} />
          <HorizontalRail title="Komik Berwarna" items={scopedHome.topUpcoming} />
        </>
      ) : (
        <HorizontalRail title="Novel Terbaru" items={typeItems} />
      )}
    </div>
  );
}
