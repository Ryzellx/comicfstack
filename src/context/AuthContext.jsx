import { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);
const STORAGE_KEY = "zetoon_user_state_v1";
const MAX_WATCHLIST = 200;
const MAX_HISTORY = 200;
const MAX_WATCHED_EPISODES = 300;

function normalizeMediaType(entry = {}) {
  const fromEntry = String(entry?.mediaType || entry?.type || "").trim().toLowerCase();
  if (["manga", "manhwa", "manhua", "novel"].includes(fromEntry)) return fromEntry;
  const source = String(entry?.source || "").toLowerCase();
  if (source === "sakuranovel") return "novel";
  return "manga";
}

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      watchHistory: Array.isArray(parsed?.watchHistory) ? parsed.watchHistory.slice(0, MAX_HISTORY) : [],
      watchlist: Array.isArray(parsed?.watchlist) ? parsed.watchlist.slice(0, MAX_WATCHLIST) : [],
      watchedEpisodes: parsed?.watchedEpisodes && typeof parsed.watchedEpisodes === "object" ? parsed.watchedEpisodes : {},
    };
  } catch {
    return { watchHistory: [], watchlist: [], watchedEpisodes: {} };
  }
}

function writeState(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore localStorage failures
  }
}

export function AuthProvider({ children }) {
  const [store, setStore] = useState(() => readState());

  const updateStore = (mapper) => {
    setStore((prev) => {
      const next = mapper(prev);
      writeState(next);
      return next;
    });
  };

  const addToWatchlist = (entry) => {
    const animeId = String(entry?.animeId || "").trim();
    if (!animeId) return { ok: false, error: "animeId wajib ada." };

    updateStore((current) => {
      const existing = Array.isArray(current.watchlist) ? current.watchlist : [];
      const filtered = existing.filter((item) => String(item?.animeId) !== animeId);
      return {
        ...current,
        watchlist: [
          {
            animeId,
            title: entry?.title || "Untitled Comic",
            poster: entry?.poster || "",
            source: entry?.source || "bacakomik",
            slug: entry?.slug || "",
            addedAt: new Date().toISOString(),
          },
          ...filtered,
        ].slice(0, MAX_WATCHLIST),
      };
    });

    return { ok: true };
  };

  const removeFromWatchlist = (animeId) => {
    const key = String(animeId || "").trim();
    if (!key) return { ok: false, error: "animeId wajib ada." };

    updateStore((current) => ({
      ...current,
      watchlist: (Array.isArray(current.watchlist) ? current.watchlist : []).filter(
        (item) => String(item?.animeId) !== key
      ),
    }));

    return { ok: true };
  };

  const markEpisodeWatched = (entry) => {
    const animeId = String(entry?.animeId || "").trim();
    if (!animeId) return { ok: false, error: "animeId wajib ada." };

    const episodeKey = String(entry?.episodeId || entry?.episodeNumber || "").trim();
    if (!episodeKey) return { ok: false, error: "episodeId/episodeNumber wajib ada." };

    updateStore((current) => {
      const watchedEpisodes = { ...(current?.watchedEpisodes || {}) };
      const currentList = Array.isArray(watchedEpisodes[animeId]) ? watchedEpisodes[animeId] : [];
      if (!currentList.includes(episodeKey)) watchedEpisodes[animeId] = [episodeKey, ...currentList].slice(0, MAX_WATCHED_EPISODES);

      const history = Array.isArray(current?.watchHistory) ? current.watchHistory : [];
      const historyId = `${animeId}:${episodeKey}`;
      const nextItem = {
        id: historyId,
        animeId,
        episodeId: entry?.episodeId || "",
        episodeNumber: entry?.episodeNumber || null,
        title: entry?.title || "Untitled Comic",
        episodeTitle: entry?.episodeTitle || "",
        poster: entry?.poster || "",
        source: entry?.source || "bacakomik",
        mediaType: normalizeMediaType(entry),
        slug: entry?.slug || "",
        watchedAt: new Date().toISOString(),
      };

      return {
        ...current,
        watchedEpisodes,
        watchHistory: [nextItem, ...history.filter((item) => item?.id !== historyId)].slice(0, MAX_HISTORY),
      };
    });

    return { ok: true };
  };

  const value = useMemo(
    () => ({
      user: { id: "guest", username: "Guest" },
      users: [],
      ready: true,
      isLoggedIn: true,
      isAdmin: false,
      isWebView: false,
      canUseGoogleAuth: false,
      signUp: async () => ({ ok: false, error: "Mode anonymous aktif." }),
      signIn: async () => ({ ok: false, error: "Mode anonymous aktif." }),
      signInWithGoogle: async () => ({ ok: false, error: "Mode anonymous aktif." }),
      signOut: async () => ({ ok: true }),
      updateProfile: async () => ({ ok: false, error: "Mode anonymous aktif." }),
      adminUpdateUser: () => ({ ok: false, error: "Akses admin dinonaktifkan." }),
      adminSetPremium: () => ({ ok: false, error: "Akses admin dinonaktifkan." }),
      adminSetPremiumByEmail: () => ({ ok: false, error: "Akses admin dinonaktifkan." }),
      watchHistory: Array.isArray(store?.watchHistory) ? store.watchHistory : [],
      watchlist: Array.isArray(store?.watchlist) ? store.watchlist : [],
      watchedEpisodes: store?.watchedEpisodes || {},
      addToWatchlist,
      removeFromWatchlist,
      markEpisodeWatched,
      adSlot: "top-center",
      adminSetAdSlot: () => ({ ok: false, error: "Akses admin dinonaktifkan." }),
      adLinks: [],
      adLink: "",
      adminSetAdLink: () => ({ ok: false, error: "Akses admin dinonaktifkan." }),
      adminSetAdLinkSlot: () => ({ ok: false, error: "Akses admin dinonaktifkan." }),
      getRandomActiveAdEntry: () => null,
      getRandomActiveAdLink: () => "",
    }),
    [store]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
