"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

interface LoginFormProps {
  nextPath: string;
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const syncServerSession = async (accessToken: string) => {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });

    if (!response.ok) {
      throw new Error("No se pudo crear la sesion de servidor.");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "login") {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError || !data.session) {
          throw new Error(signInError?.message || "Credenciales invalidas.");
        }

        await syncServerSession(data.session.access_token);
        router.replace(nextPath);
        router.refresh();
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      setMessage("Cuenta creada. Inicia sesion para continuar.");
      setMode("login");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error de autenticacion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center px-4">
      <section className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800/70 p-6 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold">Anclora Advisor</h1>
          <p className="mt-1 text-sm text-slate-300">Acceso seguro al dashboard de asesoramiento</p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-900 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              mode === "login" ? "bg-amber-400 text-slate-900" : "text-slate-300"
            }`}
          >
            Iniciar sesion
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              mode === "signup" ? "bg-amber-400 text-slate-900" : "text-slate-300"
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-200">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 outline-none focus:border-amber-400"
              placeholder="usuario@anclora.es"
              required
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-200">Contrasena</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 outline-none focus:border-amber-400"
              placeholder="********"
              required
              minLength={6}
            />
          </label>

          {error && <p className="rounded-lg border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
          {message && <p className="rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-amber-400 px-3 py-2 font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Procesando..." : mode === "login" ? "Entrar" : "Registrar"}
          </button>
        </form>
      </section>
    </main>
  );
}

