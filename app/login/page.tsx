import { login } from "./actions";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--deep-ocean)] px-4">
      <div className="w-full max-w-md bg-[var(--deep-ocean-card)] border border-white/10 rounded-2xl p-8 shadow-2xl">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--soft-gold)] to-[#e6b800] flex items-center justify-center mb-4 shadow-lg shadow-[var(--soft-gold)]/20">
            <span className="text-[var(--deep-ocean)] font-bold text-3xl">
              R
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Tripzy{" "}
            <span className="text-[var(--soft-gold)]">Rate Sentinel</span>
          </h1>
          <p className="text-[var(--text-secondary)] mt-2 text-sm text-center">
            Log in to your B2B dashboard
          </p>
        </div>

        {/* Login Form */}
        <form className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 transition-all"
              placeholder="tripzydevops@gmail.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            formAction={login}
            className="w-full btn-gold py-3 flex items-center justify-center gap-2 group font-bold text-lg"
          >
            Sign In
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-[var(--text-muted)]">
          Protected by Tripzy Security
        </div>
      </div>
    </div>
  );
}
