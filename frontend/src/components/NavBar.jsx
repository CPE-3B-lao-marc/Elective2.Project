import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { Spin as Hamburger } from "hamburger-react";
import { useState } from "react";

function NavBar() {
  const { user, logout } = useAuth();
  const [isOpen, setOpen] = useState(false);

  const navClass = ({ isActive }) =>
    `rounded-full px-4 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-sky-500 text-white"
        : "border border-white/20 bg-white/5 text-white hover:bg-white/10"
    }`;

  const closeMenu = () => setOpen(false);

  return (
    <nav className="bg-slate-950 text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 text-lg font-semibold">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-sky-400">Smart</span>
            <span>Commute Planner</span>
          </Link>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <NavLink to="/" end className={navClass}>
            Home
          </NavLink>
          <NavLink to="/map" className={navClass}>
            Planner
          </NavLink>
          {user ? (
            <>
              <NavLink to="/profile" className={navClass}>
                Profile
              </NavLink>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10 hover:cursor-pointer"
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

        <div className="relative sm:hidden">
          <Hamburger toggled={isOpen} toggle={setOpen} />

          {isOpen && (
            <div className="flex flex-col gap-3 text-center absolute right-0 top-full w-56 rounded-2xl border border-white/10 bg-slate-950 p-4 shadow-2xl shadow-black/40 z-50">
              <NavLink to="/" end className={navClass} onClick={closeMenu}>
                Home
              </NavLink>
              <NavLink to="/map" className={navClass} onClick={closeMenu}>
                Planner
              </NavLink>
              {user ? (
                <>
                  <NavLink
                    to="/profile"
                    className={navClass}
                    onClick={closeMenu}
                  >
                    Profile
                  </NavLink>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      closeMenu();
                    }}
                    className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10 hover:cursor-pointer"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className={navClass} onClick={closeMenu}>
                    Login
                  </NavLink>
                  <NavLink
                    to="/register"
                    className={navClass}
                    onClick={closeMenu}
                  >
                    Register
                  </NavLink>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default NavBar;
