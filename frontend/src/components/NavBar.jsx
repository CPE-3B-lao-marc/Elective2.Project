function NavBar() {
  return (
    <nav className="bg-slate-950 text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 text-lg font-semibold">
          <span className="text-sky-400">Smart</span>
          <span>Commute Planner</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/"
            className="rounded-full bg-sky-500 px-4 py-2 text-sm font-medium transition hover:bg-sky-400"
          >
            Route Planner
          </a>
          <button
            type="button"
            className="rounded-full border border-white/20 px-4 py-2 text-sm transition hover:bg-white/10"
          >
            Login
          </button>
        </div>
      </div>
    </nav>
  );
}

export default NavBar;
