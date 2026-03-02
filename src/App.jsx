import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AnimeDetailPage from "./pages/AnimeDetailPage";
import ContactPage from "./pages/ContactPage";
import HistoryPage from "./pages/HistoryPage";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import WatchPage from "./pages/WatchPage";
import WatchlistPage from "./pages/WatchlistPage";

function resolveWhatsAppLink() {
  const direct = String(import.meta.env.VITE_WHATSAPP_LINK || "").trim();
  if (direct) {
    const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(direct);
    return hasProtocol ? direct : `https://${direct.replace(/^\/+/, "")}`;
  }

  const numberRaw = String(import.meta.env.VITE_WHATSAPP_NUMBER || "")
    .trim()
    .replace(/[^\d]/g, "");
  if (numberRaw) return `https://wa.me/${numberRaw}`;

  return "https://wa.me/6280000000000";
}

function GlobalAnnouncement() {
  const waLink = resolveWhatsAppLink();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
      Open penempatan iklan. Hubungi admin via{" "}
      <a href={waLink} target="_blank" rel="noreferrer" className="font-semibold text-emerald-300 underline">
        WhatsApp
      </a>
      .
    </div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900/70 to-teal-950 font-body text-text">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <GlobalAnnouncement />
        <div key={location.pathname} className="mt-4 animate-page-in">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/anime/:animeId" element={<AnimeDetailPage />} />
            <Route path="/anime/:source/:animeId" element={<AnimeDetailPage />} />
            <Route path="/watch/:animeId" element={<WatchPage />} />
            <Route path="/watch/:source/:animeId" element={<WatchPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/readlist" element={<WatchlistPage />} />
            <Route path="/watchlist" element={<Navigate to="/readlist" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
      <Footer />
    </div>
  );
}
