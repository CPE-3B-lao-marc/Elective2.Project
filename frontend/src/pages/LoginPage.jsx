import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

function LoginPage() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      navigate("/map", { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      await login({ email, password });
      navigate("/map", { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-white p-10 shadow-sm">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.2em] text-sky-600">
              Secure access
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">
              Login to your commute planner
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Use your account to save favorite locations and access
              personalized route data.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-6">
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                placeholder="you@example.com"
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                placeholder="Enter your password"
                required
                autoComplete=""
              />
            </label>

            {error ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-600">
            Don’t have an account yet?{" "}
            <Link
              to="/register"
              className="font-semibold text-sky-600 hover:text-sky-500"
            >
              Create one
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

export default LoginPage;
