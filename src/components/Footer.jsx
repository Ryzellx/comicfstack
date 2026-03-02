import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="mt-8 border-t border-white/10 bg-emerald-950/70">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-3 py-5 text-sm text-emerald-100 sm:px-5 md:flex-row md:items-center md:justify-between lg:px-8">
        <p className="text-xs text-emerald-200">© {new Date().getFullYear()} Zetoon. All rights reserved.</p>
        <nav className="flex flex-wrap items-center gap-3">
          <Link to="/about" className="transition hover:text-white">
            About
          </Link>
          <Link to="/contact" className="transition hover:text-white">
            Contact
          </Link>
          <Link to="/privacy-policy" className="transition hover:text-white">
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
