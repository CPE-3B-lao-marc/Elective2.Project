import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { Spin as Hamburger } from "hamburger-react";
import { useEffect, useState } from "react";

function NavBar() {
  const { user, logout } = useAuth();
  const [isOpen, setOpen] = useState(false);
  const location = useLocation();
  const isPlannerActive = location.pathname === "/map";
  const [zIndex, setZIndex] = useState(() => {
    if (typeof window === "undefined") {
      return "z-50";
    }
    return window.innerWidth >= 640 && isPlannerActive ? "z-60" : "z-50";
  });

  const navClass = ({ isActive }) =>
    `rounded-full px-4 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-sky-500 text-white"
        : "border border-black/20 bg-white/5 text-black hover:bg-black/10"
    }`;

  const navClassLogout =
    "rounded-full border border-black/20 bg-white/5 px-4 py-2 text-sm font-medium text-black transition hover:bg-black/10 hover:cursor-pointer";

  const closeMenu = () => setOpen(false);

  //

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640 && isOpen) {
        setOpen(false);
      }
    };

    const handleZIndex = () => {
      if (window.innerWidth >= 640 && isPlannerActive) {
        setZIndex("z-60");
      } else {
        setZIndex("z-50");
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("resize", handleZIndex);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", handleZIndex);
    };
  }, [isOpen, isPlannerActive, zIndex]);

  return (
    <nav className={`fixed top-0 ${isPlannerActive ? "" : "w-full"} ${zIndex}`}>
      <div className="relative mx-auto flex w-full max-w-7xl items-center px-4 py-3">
        {/* // Mobile menu */}

        <div className={isPlannerActive ? "block z-10" : "sm:hidden"}>
          <Hamburger toggled={isOpen} toggle={setOpen} />

          {isOpen && (
            <>
              {/* // backdrop to close the menu when clicking outside of it */}
              <div
                className="fixed inset-0 z-50 bg-slate-950/30"
                onClick={closeMenu}
              />
              <div className="flex flex-col gap-3 text-center absolute left-0 top-full w-56 rounded-2xl border border-white/10 bg-mauve-100 p-4 shadow-2xl shadow-black/70 z-60">
                <NavLink to="/" end className={navClass} onClick={closeMenu}>
                  Home
                </NavLink>
                <NavLink to="/map" className={navClass} onClick={closeMenu}>
                  Planner
                </NavLink>
                <NavLink to="/about" className={navClass} onClick={closeMenu}>
                  About
                </NavLink>
                <NavLink
                  to="/privacy-policy"
                  className={navClass}
                  onClick={closeMenu}
                >
                  Privacy Policy
                </NavLink>
                <NavLink to="/terms" className={navClass} onClick={closeMenu}>
                  Terms & Conditions
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
                    <NavLink
                      to="/login"
                      className={navClass}
                      onClick={closeMenu}
                    >
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
            </>
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
          <NavLink to="/about" className={navClass}>
            About
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
