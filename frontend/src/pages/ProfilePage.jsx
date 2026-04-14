import { useState } from "react";
import { useAuth } from "../context/useAuth";

function ProfilePage({ user }) {
  const { updateProfile, profileLoading } = useAuth();
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const usernameValue = username ?? user?.username ?? "";
  const emailValue = email ?? user?.email ?? "";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    // validate email and username formats
    if (!usernameValue.trim()) {
      setError("Username cannot be empty.");
      return;
    }
    if (!emailValue.trim()) {
      setError("Email cannot be empty.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(emailValue)) {
      setError("Please enter a valid email address.");
      return;
    }

    // check if any changes were made
    if (
      usernameValue === user?.username &&
      emailValue === user?.email &&
      !oldPassword &&
      !newPassword &&
      !confirmPassword
    ) {
      setError("No changes to save.");
      return;
    }

    // Validate password fields if any of them is filled
    const updatingPassword = oldPassword || newPassword || confirmPassword;

    if (updatingPassword) {
      if (!oldPassword || !newPassword || !confirmPassword) {
        setError("To change your password, fill in all password fields.");
        return;
      }

      if (newPassword !== confirmPassword) {
        setError("New password and confirmation must match.");
        return;
      }

      if (oldPassword === newPassword) {
        setError("Your new password must be different from the old password.");
        return;
      }
    }

    try {
      const data = await updateProfile({
        username,
        email,
        oldPassword: updatingPassword ? oldPassword : undefined,
        newPassword: updatingPassword ? newPassword : undefined,
        confirmPassword: updatingPassword ? confirmPassword : undefined,
      });

      setSuccess(data.message || "Profile updated successfully.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-3xl bg-white p-10 shadow-sm">
          <p className="text-sm uppercase tracking-[0.2em] text-sky-600">
            Account settings
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">
            Profile
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Update your account details and change your password securely.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-6 rounded-3xl bg-white p-10 shadow-sm"
        >
          {error ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Username
              <input
                type="text"
                value={usernameValue}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                value={emailValue}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                required
              />
            </label>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Change password
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Only fill these fields if you want to replace your password.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Current password
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(event) => setOldPassword(event.target.value)}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  placeholder="Enter current password"
                  autoComplete=""
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                New password
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  placeholder="Enter new password"
                  minLength={6}
                  autoComplete=""
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Confirm new password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  placeholder="Repeat new password"
                  minLength={6}
                  autoComplete=""
                />
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={profileLoading}
            className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {profileLoading ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default ProfilePage;
