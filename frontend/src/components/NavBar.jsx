import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { Spin as Hamburger } from "hamburger-react";
import { useState } from "react";

function NavBar() {
  const { user, logout } = useAuth();
  const [isOpen, setOpen] = useState(false);
  const location = useLocation();
  const isPlannerActive = location.pathname === "/map";

  const navClass = ({ isActive }) =>
    `rounded-full px-4 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-sky-500 text-white"
        : "border border-black/20 bg-white/5 text-black hover:bg-black/10"
    }`;

  const navClassLogout =
    "rounded-full border border-black/20 bg-white/5 px-4 py-2 text-sm font-medium text-black transition hover:bg-black/10 hover:cursor-pointer";

  const closeMenu = () => setOpen(false);

  return (
    <nav className="fixed z-50 top-0 w-full">
      <div className="relative mx-auto flex w-full max-w-7xl items-center px-4 py-3">
        {/* // Mobile menu */}

        <div className={isPlannerActive ? "block z-10" : "sm:hidden"}>
          <Hamburger toggled={isOpen} toggle={setOpen} />

          {isOpen && (
            <div className="flex flex-col gap-3 text-center absolute left-0 top-full w-56 rounded-2xl border border-white/10 bg-mauve-100 p-4 shadow-2xl shadow-black/70 z-50">
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
                    className={navClassLogout}
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

        {/* // Logo and title */}

        <div
          className={`lg:absolute left-0 top-0 flex items-start
            gap-3 ${isPlannerActive ? "lg:pt-5.5 lg:pl-15.5" : "lg:pt-4 lg:px-10"} text-lg
            font-semibold justify-start mr-auto whitespace-nowrap
          `}
        >
          <Link to="/" className="flex items-center gap-2">
            <span className="text-sky-600">Smart</span>
            <span>Commute Planner</span>
          </Link>
        </div>

        {/* // Desktop menu */}
        <div
          className={
            isPlannerActive
              ? "hidden"
              : "hidden sm:flex items-center gap-2 justify-end lg:justify-center w-full"
          }
        >
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
              <button type="button" onClick={logout} className={navClassLogout}>
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
