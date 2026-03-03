import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ANIME_PROVIDER, NOVEL_PROVIDER, api, extractChapterImages, extractEpisodeList, extractNovelReadContent, extractObject } from "../lib/api";
import { useAuth } from "../context/AuthContext";
const READ_PROGRESS_PREFIX = "zetoon_read_progress_v1";

function toSafeText(value, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function resolveHistoryMediaType(detail, source, typeFromQuery = "") {
  const queryType = String(typeFromQuery || "").trim().toLowerCase();
  if (["manga", "manhwa", "manhua", "novel"].includes(queryType)) return queryType;

  const type = toSafeText(detail?.type).trim().toLowerCase();
  if (["manga", "manhwa", "manhua", "novel"].includes(type)) return type;

  const mediaType = toSafeText(detail?.mediaType).trim().toLowerCase();
  if (["manga", "manhwa", "manhua", "novel"].includes(mediaType)) return mediaType;

  return source === NOVEL_PROVIDER ? "novel" : "manga";
}

function buildChapterProgressKey({ source, animeId, chapterId }) {
  const s = toSafeText(source).trim().toLowerCase();
  const a = toSafeText(animeId).trim().toLowerCase();
  const c = toSafeText(chapterId).trim().toLowerCase();
  if (!s || !a || !c) return "";
  return `${READ_PROGRESS_PREFIX}:${s}:${a}:${c}`;
}

function readChapterProgress(progressKey) {
  if (!progressKey) return null;
  try {
    const raw = localStorage.getItem(progressKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeChapterProgress(progressKey, progress) {
  if (!progressKey) return;
  try {
    localStorage.setItem(progressKey, JSON.stringify(progress));
  } catch {
    // ignore storage failures
  }
}

function clearChapterProgress(progressKey) {
  if (!progressKey) return;
  try {
    localStorage.removeItem(progressKey);
  } catch {
    // ignore storage failures
  }
}

function sortEpisodesDescending(list = []) {
  return [...list].sort((a, b) => {
    const aNum = Number(a?.number || 0);
    const bNum = Number(b?.number || 0);
    if (aNum && bNum) return bNum - aNum;
    return String(b?.title || "").localeCompare(String(a?.title || ""), "id", { sensitivity: "base" });
  });
}

export default function WatchPage() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { markEpisodeWatched } = useAuth();

  const animeId = params.animeId || "";
  const sourceParam = params.source || ANIME_PROVIDER;
  const source = sourceParam || ANIME_PROVIDER;
  const searchParams = new URLSearchParams(location.search);
  const slug = searchParams.get("slug") || animeId;
  const chapterFromQuery = searchParams.get("chapter") || "";
  const typeFromQuery = searchParams.get("type") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState({});
  const [episodes, setEpisodes] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState("");
  const [images, setImages] = useState([]);
  const [novelContent, setNovelContent] = useState({ html: "", paragraphs: [] });
  const pageTopRef = useRef(null);
  const fullscreenScrollRef = useRef(null);
  const restoreLockUntilRef = useRef(0);
  const [isReaderFullscreen, setIsReaderFullscreen] = useState(false);
  const [showNextPrompt, setShowNextPrompt] = useState(false);
  const [dismissedNextPrompt, setDismissedNextPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const scrollToTop = () => {
      pageTopRef.current?.scrollIntoView({ block: "start" });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    // Android Chrome kadang restore posisi scroll lama saat route/content berubah.
    scrollToTop();
    const rafId = window.requestAnimationFrame(scrollToTop);
    const timerId = window.setTimeout(scrollToTop, 120);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [location.pathname, location.search]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const targetSlug = slug || animeId;
        const [detailRes, episodesRes] = await Promise.allSettled([
          api.getAnimeDetail(targetSlug, { source }),
          api.getAnimeEpisodes(targetSlug, { source }),
        ]);

        if (!active) return;

        const normalizedDetail = detailRes.status === "fulfilled" ? extractObject(detailRes.value, "anime") : {};
        const parsedEpisodesUnsorted = episodesRes.status === "fulfilled" ? extractEpisodeList(episodesRes.value) : [];
        const parsedEpisodes = sortEpisodesDescending(parsedEpisodesUnsorted);

        setDetail(normalizedDetail);
        setEpisodes(parsedEpisodes);

        const firstChapter = parsedEpisodes[0]?.episodeId || "";
        setSelectedChapter(chapterFromQuery || firstChapter);
      } catch (err) {
        setError(err.message || "Gagal memuat halaman baca.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [animeId, source, slug, chapterFromQuery]);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!selectedChapter) {
        setImages([]);
        setNovelContent({ html: "", paragraphs: [] });
        return;
      }

      try {
        setError("");
        const payload = await api.getChapter(selectedChapter, { source });
        if (!active) return;

        const pages = extractChapterImages(payload);
        if (source === NOVEL_PROVIDER) {
          setNovelContent(extractNovelReadContent(payload));
          setImages([]);
        } else {
          setImages(pages);
          setNovelContent({ html: "", paragraphs: [] });
        }

        const currentChapter = episodes.find((item) => item?.episodeId === selectedChapter) || null;
        markEpisodeWatched({
          animeId: detail?.animeId || animeId,
          episodeId: selectedChapter,
          episodeNumber: Number(currentChapter?.number) || null,
          title: detail?.title || animeId,
          episodeTitle: toSafeText(currentChapter?.title),
          poster: detail?.poster || "",
          source: source || ANIME_PROVIDER,
          mediaType: resolveHistoryMediaType(detail, source, typeFromQuery),
          slug,
        });
      } catch (err) {
        if (!active) return;
        setImages([]);
        setNovelContent({ html: "", paragraphs: [] });
        setError(err.message || "Gagal memuat chapter.");
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedChapter, episodes, animeId, detail?.animeId, detail?.title, detail?.poster, source, slug, typeFromQuery, markEpisodeWatched]);

  const chapterProgressKey = useMemo(
    () =>
      buildChapterProgressKey({
        source,
        animeId: detail?.animeId || animeId,
        chapterId: selectedChapter,
      }),
    [source, detail?.animeId, animeId, selectedChapter]
  );

  useEffect(() => {
    if (!selectedChapter || typeof window === "undefined") return;

    const hasNovelContent = Boolean(novelContent.html) || novelContent.paragraphs.length > 0;
    const hasComicContent = images.length > 0;
    if (!hasNovelContent && !hasComicContent) return;

    const saved = readChapterProgress(chapterProgressKey);
    restoreLockUntilRef.current = Date.now() + 800;

    const restoreScroll = () => {
      if (saved && Number(saved.scrollY) > 0 && !saved.completed) {
        window.scrollTo({ top: Number(saved.scrollY), left: 0, behavior: "auto" });
      } else {
        pageTopRef.current?.scrollIntoView({ block: "start" });
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    };

    restoreScroll();
    const rafId = window.requestAnimationFrame(restoreScroll);
    const timerId = window.setTimeout(restoreScroll, 120);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [selectedChapter, chapterProgressKey, images.length, novelContent.html, novelContent.paragraphs.length]);

  useEffect(() => {
    if (!selectedChapter || !chapterProgressKey || typeof window === "undefined") return;

    let ticking = false;
    const onScroll = () => {
      if (Date.now() < restoreLockUntilRef.current) return;
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        const scrollY = Math.max(window.scrollY || 0, document.documentElement.scrollTop || 0, document.body.scrollTop || 0);
        const viewportH = window.innerHeight || 0;
        const docH = Math.max(
          document.body.scrollHeight || 0,
          document.documentElement.scrollHeight || 0,
          document.body.offsetHeight || 0,
          document.documentElement.offsetHeight || 0
        );
        const isCompleted = scrollY + viewportH >= docH - 80;

        if (isCompleted) {
          // Saat chapter sudah selesai dibaca, buka ulang akan mulai dari atas.
          clearChapterProgress(chapterProgressKey);
          return;
        }

        writeChapterProgress(chapterProgressKey, {
          scrollY,
          completed: false,
          updatedAt: new Date().toISOString(),
        });
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [selectedChapter, chapterProgressKey]);

  useEffect(() => {
    if (!isReaderFullscreen) {
      setShowNextPrompt(false);
      setDismissedNextPrompt(false);
      return;
    }

    const container = fullscreenScrollRef.current;
    if (!container) return;

    const onScroll = () => {
      const nearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 80;
      if (!nearBottom) {
        setShowNextPrompt(false);
        setDismissedNextPrompt(false);
        return;
      }
      if (!dismissedNextPrompt) setShowNextPrompt(true);
    };

    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [isReaderFullscreen, dismissedNextPrompt, selectedChapter, images.length, novelContent.html, novelContent.paragraphs.length]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!isReaderFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isReaderFullscreen]);

  const chapterIndex = useMemo(() => episodes.findIndex((item) => item?.episodeId === selectedChapter), [episodes, selectedChapter]);
  const nextChapter = chapterIndex > 0 ? episodes[chapterIndex - 1] : null;
  const prevChapter = chapterIndex >= 0 && chapterIndex < episodes.length - 1 ? episodes[chapterIndex + 1] : null;
  const changeChapter = (chapter) => {
    if (!chapter?.episodeId) return;
    setDismissedNextPrompt(false);
    setShowNextPrompt(false);
    setSelectedChapter(chapter.episodeId);
  };
  const selectChapter = (chapterId) => {
    setDismissedNextPrompt(false);
    setShowNextPrompt(false);
    setSelectedChapter(chapterId || "");
  };

  const openReaderFullscreen = () => {
    setDismissedNextPrompt(false);
    setShowNextPrompt(false);
    setIsReaderFullscreen(true);
  };

  const closeReaderFullscreen = () => {
    setIsReaderFullscreen(false);
    setDismissedNextPrompt(false);
    setShowNextPrompt(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-emerald-300" />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div ref={pageTopRef} />
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
      >
        Kembali
      </button>

      <div className="rounded-3xl border border-white/10 bg-emerald-900/60 p-4">
        <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">{detail.title || `Komik ${animeId}`}</h1>
        <p className="mt-2 text-sm text-emerald-100">
          {source === NOVEL_PROVIDER
            ? "Pilih chapter lalu baca konten novel di bawah."
            : "Pilih chapter lalu baca gambar halaman di bawah."}
        </p>
      </div>

      {error ? <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-emerald-900/60 p-4 sm:grid-cols-2">
        <label className="text-sm text-slate-200 sm:col-span-2">
          <span className="mb-1 block text-xs uppercase tracking-wider text-emerald-200">Chapter</span>
          <select
            value={selectedChapter}
            onChange={(e) => selectChapter(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-emerald-950/80 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/60"
          >
            {episodes.map((item) => (
              <option key={item.episodeId || item.id || item.title} value={item.episodeId || ""}>
                {item.releaseText ? `${item.title} - rilis ${item.releaseText}` : item.title}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => changeChapter(prevChapter)}
          disabled={!prevChapter}
          className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Chapter Sebelumnya
        </button>
        <button
          type="button"
          onClick={() => changeChapter(nextChapter)}
          disabled={!nextChapter}
          className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Chapter Berikutnya
        </button>
        <button
          type="button"
          onClick={openReaderFullscreen}
          className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 sm:col-span-2"
        >
          Masuk Fullscreen Chapter
        </button>
      </div>

      <div>
        {source === NOVEL_PROVIDER ? (
          <div className="rounded-2xl border border-white/10 bg-emerald-950 p-4 sm:p-6">
            {novelContent.html ? (
              <article
                className="max-w-none space-y-4 text-[15px] leading-7 text-slate-200"
                dangerouslySetInnerHTML={{ __html: novelContent.html }}
              />
            ) : novelContent.paragraphs.length > 0 ? (
              <article className="space-y-4">
                {novelContent.paragraphs.map((line, index) => (
                  <p key={`${selectedChapter}-line-${index + 1}`} className="text-[15px] leading-7 text-slate-200">
                    {line}
                  </p>
                ))}
              </article>
            ) : (
              <p className="text-sm text-emerald-100">Konten chapter novel belum tersedia.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-black p-2 sm:p-3">
            {images.length > 0 ? (
              images.map((img, index) => (
                <img
                  key={`${selectedChapter}-page-${index + 1}`}
                  src={img}
                  alt={`Page ${index + 1}`}
                  className="w-full rounded-md"
                  loading={index < 2 ? "eager" : "lazy"}
                />
              ))
            ) : (
              <p className="p-4 text-sm text-emerald-100">Gambar chapter belum tersedia.</p>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-emerald-900/60 p-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => changeChapter(prevChapter)}
          disabled={!prevChapter}
          className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Chapter Sebelumnya
        </button>
        <button
          type="button"
          onClick={() => changeChapter(nextChapter)}
          disabled={!nextChapter}
          className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Chapter Berikutnya
        </button>
        <button
          type="button"
          onClick={openReaderFullscreen}
          className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 sm:col-span-2"
        >
          Masuk Fullscreen Chapter
        </button>
      </div>

      {isReaderFullscreen ? (
        <div className="fixed inset-0 z-[90] bg-black/95">
          <div ref={fullscreenScrollRef} className="h-full overflow-y-auto p-3 pb-24 sm:p-4 sm:pb-24">
            <div className="mx-auto w-full max-w-5xl space-y-4">
              <div className="sticky top-0 z-10 rounded-2xl border border-white/15 bg-black/80 p-3 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{detail.title || `Komik ${animeId}`}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => changeChapter(prevChapter)}
                      disabled={!prevChapter}
                      className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      onClick={() => changeChapter(nextChapter)}
                      disabled={!nextChapter}
                      className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Berikutnya
                    </button>
                    <button
                      type="button"
                      onClick={closeReaderFullscreen}
                      className="rounded-lg border border-rose-300/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-100"
                    >
                      Kembali dari Fullscreen
                    </button>
                  </div>
                </div>
                <label className="mt-2 block text-xs text-emerald-200">
                  <span className="mb-1 block uppercase tracking-wide">Pilih Chapter</span>
                  <select
                    value={selectedChapter}
                    onChange={(e) => selectChapter(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/60"
                  >
                    {episodes.map((item) => (
                      <option key={item.episodeId || item.id || item.title} value={item.episodeId || ""}>
                        {item.releaseText ? `${item.title} - rilis ${item.releaseText}` : item.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {source === NOVEL_PROVIDER ? (
                <div className="rounded-2xl border border-white/10 bg-emerald-950 p-4 sm:p-6">
                  {novelContent.html ? (
                    <article
                      className="max-w-none space-y-4 text-[15px] leading-7 text-slate-200"
                      dangerouslySetInnerHTML={{ __html: novelContent.html }}
                    />
                  ) : novelContent.paragraphs.length > 0 ? (
                    <article className="space-y-4">
                      {novelContent.paragraphs.map((line, index) => (
                        <p key={`${selectedChapter}-line-fs-${index + 1}`} className="text-[15px] leading-7 text-slate-200">
                          {line}
                        </p>
                      ))}
                    </article>
                  ) : (
                    <p className="text-sm text-emerald-100">Konten chapter novel belum tersedia.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 rounded-2xl border border-white/10 bg-black p-2 sm:p-3">
                  {images.length > 0 ? (
                    images.map((img, index) => (
                      <img
                        key={`${selectedChapter}-page-fs-${index + 1}`}
                        src={img}
                        alt={`Page ${index + 1}`}
                        className="w-full rounded-md"
                        loading={index < 2 ? "eager" : "lazy"}
                      />
                    ))
                  ) : (
                    <p className="p-4 text-sm text-emerald-100">Gambar chapter belum tersedia.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {showNextPrompt ? (
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[95] p-3 sm:p-4">
              <div className="pointer-events-auto mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/15 bg-black/90 p-3">
                {nextChapter ? (
                  <>
                    <p className="text-sm text-white">Sudah mentok chapter ini. Lanjut ke chapter berikutnya?</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => changeChapter(nextChapter)}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Ya, Lanjut
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNextPrompt(false);
                          setDismissedNextPrompt(true);
                        }}
                        className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white"
                      >
                        Tidak
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-white">Ini chapter terakhir.</p>
                    <button
                      type="button"
                      onClick={closeReaderFullscreen}
                      className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white"
                    >
                      Kembali dari Fullscreen
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <Link
        to={`/anime/${encodeURIComponent(source || ANIME_PROVIDER)}/${encodeURIComponent(animeId)}${
          slug ? `?slug=${encodeURIComponent(slug)}` : ""
        }`}
        className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
      >
        Back to Detail
      </Link>
    </section>
  );
}








