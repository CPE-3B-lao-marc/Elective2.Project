import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import {
  FiMap,
  FiCloudRain,
  FiBookmark,
  FiBarChart2,
  FiClock,
  FiWind,
  FiStar,
} from "react-icons/fi";

const features = [
  {
    title: "Multi-transport routing",
    description:
      "Compare driving, transit, walking, and biking routes with one planner.",
    icon: FiMap,
  },
  {
    title: "Traffic and weather context",
    description:
      "Route recommendations combine live traffic and weather signals for safer choices.",
    icon: FiCloudRain,
  },
  {
    title: "Saved locations",
    description:
      "Sign in to keep favorite stops and reuse them across every commute.",
    icon: FiBookmark,
  },
  {
    title: "Route comparison",
    description:
      "See travel time, distance, and mode differences side by side.",
    icon: FiBarChart2,
  },
];

const highlights = [
  {
    label: "Live route estimates",
    value: "Distance, ETA, and traffic",
    icon: FiClock,
  },
  {
    label: "Weather-aware planning",
    value: "OpenWeather warnings built in",
    icon: FiWind,
  },
  {
    label: "Saved favorites",
    value: "Reuse frequent trips",
    icon: FiStar,
  },
];

function HomePage() {
  return (
    <>
      <main className="min-h-screen bg-slate-100 text-slate-900">
        <section className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div className="space-y-6">
              <p className="inline-flex rounded-full bg-sky-100 px-4 py-1 text-sm font-semibold text-sky-700">
                Commute planning made clearer
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Plan faster commutes with Google Maps and Mapbox.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-700">
                Smart Commute Planner brings together Google Maps traffic,
                Mapbox visuals, and weather-aware route comparison in one
                polished commute dashboard.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  to="/map"
                  className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
                >
                  Start planning
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400"
                >
                  Create account
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {highlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {item.value}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-4xl bg-linear-to-br from-sky-500 via-slate-900 to-indigo-600 p-1 shadow-xl shadow-slate-400/20">
              <div className="h-full rounded-[1.75rem] bg-slate-950 p-8 text-white">
                <div className="mb-8 rounded-3xl bg-slate-900 p-6 shadow-inner shadow-slate-950/30">
                  <p className="text-sm uppercase tracking-[0.2em] text-sky-300">
                    Planner snapshot
                  </p>
                  <h2 className="mt-3 text-xl font-semibold">
                    Your next commute, ready to review
                  </h2>
                </div>
                <div className="space-y-5">
                  <div className="rounded-3xl border border-white/10 bg-slate-900 p-6">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Destination
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-white">
                      Makati, Philippines
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl bg-slate-900 p-5">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Mode
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        Driving
                      </p>
                    </div>
                    <div className="rounded-3xl bg-slate-900 p-5">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        ETA
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        38 min
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section className="grid gap-10 lg:grid-cols-2">
            <div className="rounded-3xl bg-white p-8 shadow-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-sky-600">
                Designed for commuters
              </p>
              <h2 className="mt-4 text-2xl font-semibold text-slate-950">
                A focused planner with every route insight.
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-700">
                Build your itinerary from one place. See route options, save
                stops, and jump back into the map with a single click.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={feature.title}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                    >
                      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <h3 className="text-base font-semibold text-slate-950">
                        {feature.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {feature.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl bg-slate-950 p-8 text-white shadow-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-sky-300">
                How it works
              </p>
              <h2 className="mt-4 text-2xl font-semibold">
                Get moving in three easy steps.
              </h2>
              <div className="mt-6 space-y-4 text-sm leading-7 text-slate-200">
                <div className="rounded-3xl bg-slate-900 p-5">
                  <p className="font-semibold">
                    1. Add your origin and destination
                  </p>
                  <p className="mt-2 text-slate-400">
                    Type or select addresses with Google Places autocomplete.
                  </p>
                </div>
                <div className="rounded-3xl bg-slate-900 p-5">
                  <p className="font-semibold">2. Compare transport modes</p>
                  <p className="mt-2 text-slate-400">
                    Switch between drive, transit, walk, and bike to find the
                    best route.
                  </p>
                </div>
                <div className="rounded-3xl bg-slate-900 p-5">
                  <p className="font-semibold">3. Save your favorite routes</p>
                  <p className="mt-2 text-slate-400">
                    Keep frequent trips accessible and reuse them instantly.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-sky-600">
                  Ready to plan?
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                  Open the planner and build your next commute.
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/map"
                  className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
                >
                  Open planner
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400"
                >
                  Login
                </Link>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-700">
              The product is focused on essential commute workflows today, with
              weather support coming later.
            </p>
          </section>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default HomePage;
