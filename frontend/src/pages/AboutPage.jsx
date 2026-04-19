import { FiGithub, FiUsers, FiMap, FiShield } from "react-icons/fi";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";

const team = [
  {
    name: "Arillano, John Loyd",
    photo: "/1.jpg",
    github: "https://github.com/CPE3B-ARILLANO-JOHNLLOYD",
  },
  {
    name: "Carlos, Jelo",
    photo: "/2.jpg",
    role: "",
    github: "https://github.com/carlosjelo081-arch",
  },
  {
    name: "Escandor, Christian Eric",
    photo: "/3.jpg",
    role: "",
    github: "https://github.com/CPE3B-escandor-christian",
  },
  {
    name: "Lao, Marc Adrian",
    photo: "/4.jpg",
    role: "",
    github: "https://github.com/CPE-3B-lao-marc",
  },
];

function AboutPage() {
  return (
    <>
      <main className="min-h-screen bg-slate-100 text-slate-950">
        <section className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-16 sm:px-6 lg:px-8">
          <div className="space-y-5 rounded-4xl bg-white p-10 shadow-sm shadow-slate-200">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-3">
                <p className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.25em] text-sky-600">
                  <FiUsers className="h-4 w-4" aria-hidden="true" />
                  About SmartCommutePlanner
                </p>
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  We build smarter commutes with clarity and confidence.
                </h1>
              </div>
              <Link
                to="/map"
                className="whitespace-nowrap inline-flex items-center justify-center gap-2 rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
              >
                <FiMap className="h-4 w-4" aria-hidden="true" />
                Open the planner
              </Link>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
              <div className="space-y-6">
                <p className="text-base leading-8 text-slate-700">
                  SmartCommutePlanner helps commuters choose routes that feel
                  safer, faster, and more reliable. We combine live traffic,
                  route comparison, and weather signals so every decision is
                  supported by the data that matters.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                      <FiMap className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="text-lg font-semibold text-slate-950">
                      Route-first thinking
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Map-based planning that keeps your destination front and
                      center.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                      <FiShield className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="text-lg font-semibold text-slate-950">
                      Trusted commute insights
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      A secure, dependable place to evaluate every route and
                      plan ahead.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-4xl border border-slate-200 bg-slate-950 p-8 text-white shadow-sm shadow-slate-300/10">
                <p className="text-sm uppercase tracking-[0.2em] text-sky-300">
                  Our mission
                </p>
                <h2 className="mt-4 text-2xl font-semibold">
                  Make every commute feel intentional.
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-300">
                  We design route planning around real-world needs: cleaner
                  alternatives, clearer schedules, and fewer surprises. This
                  page is our promise to stay transparent, collaborative, and
                  user-first.
                </p>
              </div>
            </div>
          </div>

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-sm shadow-sky-300/20">
                <FiUsers className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-sky-600">
                  Team
                </p>
                <h2 className="text-3xl font-semibold text-slate-950">
                  Meet the people behind the planner.
                </h2>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {team.map((member) => (
                <article
                  key={member.name}
                  className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-20 w-20 md:h-38 md:w-38 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
                      <img
                        src={`${member.photo}`}
                        alt={`${member.name} profile`}
                        className="h-full w-full rounded-3xl object-cover"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-base md:text-2xl font-semibold text-slate-950 md:mt-7">
                        {member.name}
                      </p>

                      <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
                        <a
                          href={member.github}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-slate-700 transition hover:text-sky-600"
                          aria-label={`Visit ${member.name} GitHub profile`}
                        >
                          <FiGithub className="h-6 w-6" aria-hidden="true" />
                          GitHub
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default AboutPage;
