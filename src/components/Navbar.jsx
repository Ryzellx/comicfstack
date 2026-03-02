import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const navClass = ({ isActive }) =>
    `rounded-full px-3 py-1.5 text-sm transition ${isActive ? "bg-white/10 text-white" : "text-emerald-100 hover:text-white"}`;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-emerald-950/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="font-heading text-xl font-bold tracking-tight text-white">
          Zetoon
        </Link>

        <button
          type="button"
          className="rounded-lg border border-white/15 p-2 text-emerald-100 md:hidden"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
        >
          <span className="sr-only">Toggle menu</span>
          {menuOpen ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>

        <nav className="hidden items-center gap-2 md:flex">
          <NavLink to="/" className={navClass}>
            Home
          </NavLink>
          <NavLink to="/history" className={navClass}>
            Riwayat
          </NavLink>
          <NavLink to="/readlist" className={navClass}>
            ReadList
          </NavLink>
        </nav>
      </div>

      {menuOpen ? (
        <div id="mobile-nav" className="border-t border-white/10 bg-emerald-950/95 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-2">
            <NavLink to="/" className={navClass} onClick={() => setMenuOpen(false)}>
              Home
            </NavLink>
            <NavLink to="/history" className={navClass} onClick={() => setMenuOpen(false)}>
              Riwayat
            </NavLink>
            <NavLink to="/readlist" className={navClass} onClick={() => setMenuOpen(false)}>
              ReadList
            </NavLink>
          </div>
        </div>
      ) : null}
    </header>
  );
}
