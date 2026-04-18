import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.2em] text-sky-400">
              SmartCommutePlanner
            </p>
            <h2 className="max-w-xl text-2xl font-semibold text-white">
              A calm, confident finish for every commute.
            </h2>
            <p className="max-w-lg text-sm leading-7 text-slate-400">
              Stay connected to route updates, support, and policy details no
              matter where you are in the planner.
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Quick Links
            </p>
            <div className="flex flex-wrap items-center justify-start gap-3 text-sm text-slate-300">
              <Link
                to="/"
                className="transition hover:text-white"
                aria-label="Go to Home"
              >
                Home
              </Link>
              <span className="text-slate-600">|</span>
              <Link
                to="/about"
                className="transition hover:text-white"
                aria-label="Go to About page"
              >
                About
              </Link>
            </div>
          </div>

          <div className="space-y-4" id="contact">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Contact Us
            </p>
            <div className="space-y-3 text-sm leading-7 text-slate-300">
              <p>
                <span className="font-semibold text-white">Email:</span>{" "}
                <a
                  href="mailto:smartcommuteplanner@gmail.com"
                  className="transition hover:text-white"
                >
                  smartcommuteplanner@gmail.com
                </a>
              </p>
              <p>
                <span className="font-semibold text-white">Phone:</span>{" "}
                <a
                  href="tel:+639123456789"
                  className="transition hover:text-white"
                >
                  +63 912 345 6789
                </a>
              </p>
              <p>
                <span className="font-semibold text-white">Location:</span>{" "}
                Malolos, Philippines
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-800 pt-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 SmartCommutePlanner</p>
          <div className="flex flex-wrap items-center gap-4 text-slate-400">
            <a
              href="/privacy-policy"
              className="transition hover:text-white"
              aria-label="Privacy Policy"
            >
              Privacy Policy
            </a>
            <span className="text-slate-700">|</span>
            <a
              href="/terms"
              className="transition hover:text-white"
              aria-label="Terms and Conditions"
            >
              Terms & Conditions
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
