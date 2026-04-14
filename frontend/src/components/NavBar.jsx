import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";

function NavBar() {
  const { user, logout } = useAuth();

  const navClass = ({ isActive }) =>
    `rounded-full px-4 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-sky-500 text-white"
        : "border border-white/20 bg-white/5 text-white hover:bg-white/10"
    }`;

  return (
    <nav className="bg-slate-950 text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 text-lg font-semibold">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-sky-400">Smart</span>
            <span>Commute Planner</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <NavLink to="/" end className={navClass}>
            Home
          </NavLink>
          <NavLink to="/map" className={navClass}>
            Planner
          </NavLink>
          {user ? (
            <>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                Hi, {user.username}
              </span>
              <NavLink to="/profile" className={navClass}>
                Profile
              </NavLink>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navClass}>
                Login
              </NavLink>
              <NavLink to="/register" className={navClass}>
                Register
              </NavLink>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default NavBar;
