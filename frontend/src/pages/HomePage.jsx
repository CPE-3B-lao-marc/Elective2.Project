import { Link } from "react-router-dom";

const features = [
  {
    title: "Multi-transport routing",
    description: "Switch between driving, transit, walking, and biking with one planner.",
  },
  {
    title: "Fast route estimates",
    description: "See distance and travel time instantly with Google Maps Directions.",
  },
  {
    title: "Mapbox-powered map",
    description: "A modern, interactive map experience for every commute.",
  },
  {
    title: "Save favorite locations",
    description: "Store places for quick reuse and faster planning.",
  },
];

function HomePage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <section className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-6">
            <span className="inline-flex rounded-full bg-sky-100 px-4 py-1 text-sm font-semibold text-sky-700">
              Smart Commute Planner
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Plan smarter commutes with Google Maps and Mapbox
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-700">
              Compare routes across driving, transit, walking, and biking while keeping favorite locations ready.
              Start with accurate route estimates today and keep the rest of the features for later.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/map"
                className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
              >
                Start planning
              </Link>
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400"
              >
                Learn how it works
              </Link>
            </div>
          </div>

          <div className="rounded-4xl bg-linear-to-br from-sky-600 via-blue-500 to-indigo-600 p-1 shadow-xl shadow-slate-400/10">
            <div className="h-full rounded-[1.75rem] bg-slate-950 p-8 text-white">
              <div className="mb-8 rounded-3xl bg-slate-900 p-6 shadow-inner shadow-slate-950/30">
                <h2 className="text-lg font-semibold">Your route at a glance</h2>
                <p className="mt-3 text-sm text-slate-300">
                  Tap into Google Directions and Mapbox for a clean, map-first commute experience.
                </p>
              </div>
              <div className="space-y-5">
                <div className="rounded-3xl border border-white/10 bg-slate-900 p-5">
                  <p className="text-sm uppercase tracking-[0.2em] text-sky-300">Destination</p>
                  <p className="mt-3 text-xl font-semibold">Makati, Philippines</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl bg-slate-900 p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Mode</p>
                    <p className="mt-2 text-lg font-semibold text-white">Driving</p>
                  </div>
                  <div className="rounded-3xl bg-slate-900 p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">ETA</p>
                    <p className="mt-2 text-lg font-semibold text-white">38 min</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-10 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-950">Why use Smart Commute Planner?</h2>
            <p className="mt-4 text-base leading-8 text-slate-700">
              This project combines the power of Google Maps Directions with Mapbox visuals to help you choose the best commute route quickly.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {features.map((feature) => (
                <div key={feature.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-base font-semibold text-slate-950">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-slate-950 p-8 text-white shadow-sm">
            <h2 className="text-2xl font-semibold">How it works</h2>
            <div className="mt-6 space-y-4 text-sm leading-7 text-slate-200">
              <div className="rounded-3xl bg-slate-900 p-5">
                <p className="font-semibold">1. Enter your route</p>
                <p className="mt-2 text-slate-400">Type origin and destination to start planning.</p>
              </div>
              <div className="rounded-3xl bg-slate-900 p-5">
                <p className="font-semibold">2. Choose transport mode</p>
                <p className="mt-2 text-slate-400">Pick driving, transit, walking, or biking routes.</p>
              </div>
              <div className="rounded-3xl bg-slate-900 p-5">
                <p className="font-semibold">3. View route preview</p>
                <p className="mt-2 text-slate-400">See the route on the map plus distance and travel time.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-sky-600">Built for the commute</p>
              <h2 className="text-2xl font-semibold text-slate-950">Google Maps + Mapbox ecosystem</h2>
            </div>
            <Link
              to="/map"
              className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Open planner
            </Link>
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            The app is focused on routing and saved locations first. Weather features are planned for a later phase.
          </p>
        </section>
      </section>
    </main>
  );
}

export default HomePage;
