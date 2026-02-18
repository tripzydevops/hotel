"use client";

import { createUser } from "./actions";
import { useState } from "react";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-gold px-4 py-2 w-full flex justify-center"
    >
      {pending ? "Creating..." : "Create User"}
    </button>
  );
}

export default function CreateUserForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function clientAction(formData: FormData) {
    const result = await createUser(formData);
    if (result?.error) {
      setError(result.error);
      setMessage(null);
    } else if (result?.success) {
      setMessage(result.success);
      setError(null);
      // Reset form
      const form = document.getElementById(
        "create-user-form",
      ) as HTMLFormElement;
      form?.reset();
    }
  }

  return (
    <div className="bg-[var(--deep-ocean-card)] p-6 rounded-xl border border-white/10">
      <h2 className="text-xl font-bold text-white mb-4">
        Provision New Client
      </h2>

      {message && (
        <div className="bg-green-500/10 border border-green-500/50 text-green-400 p-3 rounded-lg mb-4 text-sm">
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <form id="create-user-form" action={clientAction} className="space-y-4">
        <div>
          <label className="block text-sm text-[var(--text-secondary)] mb-1">
            Company / Email
          </label>
          <input
            name="email"
            type="email"
            required
            placeholder="client@company.com"
            className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--text-secondary)] mb-1">
            Temporary Password
          </label>
          <input
            name="password"
            type="text"
            required
            placeholder="Tripzy2025!"
            className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white"
          />
        </div>
        <SubmitButton />
      </form>
    </div>
  );
}
