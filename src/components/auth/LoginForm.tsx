"use client";

import Image from "next/image";
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
  const [showPassword, setShowPassword] = useState(false);
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
      throw new Error("No se pudo crear la sesión de servidor.");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "login") {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError || !data.session) {
          throw new Error(signInError?.message || "Credenciales inválidas.");
        }
        await syncServerSession(data.session.access_token);
        router.replace(nextPath);
        router.refresh();
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw new Error(signUpError.message);

      setMessage("Cuenta creada. Inicia sesión para continuar.");
      setMode("login");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error de autenticación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.main}>
      {/* Background decorative blobs */}
      <div style={styles.blobTop} aria-hidden="true" />
      <div style={styles.blobBottom} aria-hidden="true" />

      <div style={styles.wrapper}>
        {/* Brand header */}
        <header style={styles.brandHeader}>
          <div style={styles.logoWrap}>
            <Image
              src="/brand/Logo-Advisor_1.png"
              alt="Logo de Anclora Advisor"
              width={84}
              height={84}
              priority
              style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
            />
          </div>
          <span style={styles.logoText}>Anclora Advisor AI</span>
        </header>

        <div style={styles.contentWrap}>
          {/* Card */}
          <section style={styles.card} aria-label="Formulario de acceso">
            <div style={styles.cardHeader}>
              <h1 style={styles.cardTitle}>
                {mode === "login" ? "Bienvenido de nuevo" : "Crear cuenta"}
              </h1>
              <p style={styles.cardSubtitle}>
                {mode === "login"
                  ? "Accede a tu asesoramiento fiscal y laboral"
                  : "Empieza a gestionar tu actividad como autónomo"}
              </p>
            </div>

            {/* Mode tabs */}
            <div style={styles.tabs} role="tablist">
              <button
                id="tab-login"
                role="tab"
                type="button"
                aria-selected={mode === "login"}
                aria-controls="panel-form"
                onClick={() => { setMode("login"); setError(null); setMessage(null); }}
                style={{ ...styles.tab, ...(mode === "login" ? styles.tabActive : {}) }}
              >
                Iniciar sesión
              </button>
              <button
                id="tab-signup"
                role="tab"
                type="button"
                aria-selected={mode === "signup"}
                aria-controls="panel-form"
                onClick={() => { setMode("signup"); setError(null); setMessage(null); }}
                style={{ ...styles.tab, ...(mode === "signup" ? styles.tabActive : {}) }}
              >
                Crear cuenta
              </button>
            </div>

            {/* Form */}
            <form id="panel-form" role="tabpanel" onSubmit={handleSubmit} style={styles.form} noValidate>
              <div style={styles.fieldGroup}>
                <label htmlFor="email" className="advisor-label">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="advisor-input"
                  placeholder="usuario@anclora.es"
                  required
                />
              </div>

              <div style={styles.fieldGroup}>
                <label htmlFor="password" className="advisor-label">
                  Contraseña
                </label>
                <div style={styles.passwordWrap}>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="advisor-input"
                    placeholder={mode === "login" ? "Tu contraseña" : "Mínimo 6 caracteres"}
                    required
                    minLength={6}
                    style={styles.passwordInput}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    style={styles.passwordToggle}
                  >
                    {showPassword ? (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6A3 3 0 0 0 13.4 13.4" />
                        <path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c5.1 0 9.3 3.7 10 7-0.3 1.3-1.2 2.8-2.6 4.1" />
                        <path d="M6.7 6.8C4.8 8 3.5 9.7 3 12c0.7 3.3 4.9 7 10 7 1.5 0 2.9-0.3 4.2-0.8" />
                      </svg>
                    ) : (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="advisor-alert advisor-alert-error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="16" r="1" fill="currentColor" />
                  </svg>
                  {error}
                </div>
              )}

              {message && (
                <div role="status" className="advisor-alert advisor-alert-success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {message}
                </div>
              )}

              <button
                id="btn-submit"
                type="submit"
                disabled={loading}
                className="advisor-btn advisor-btn-primary advisor-btn-full"
                style={{ marginTop: 4 }}
              >
                {loading ? (
                  <>
                    <span className="advisor-spinner" aria-hidden="true" />
                    Procesando…
                  </>
                ) : (
                  mode === "login" ? "Entrar al dashboard" : "Crear mi cuenta"
                )}
              </button>
            </form>
          </section>

          {/* Footer */}
          <footer style={styles.footer}>
            <p style={styles.footerText}>
              Plataforma de asesoramiento para autónomos&nbsp;·&nbsp;
              <span style={{ color: "var(--advisor-accent)", fontWeight: 500 }}>Anclora Group</span>
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}

/* ── Inline styles (layout only, no theming) ─────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 16px",
    position: "relative",
    overflow: "hidden",
    background:
      "radial-gradient(1400px 700px at 15% -10%, rgba(29,171,137,0.10), transparent 65%)," +
      "radial-gradient(1200px 600px at 95% 100%, rgba(22,41,68,0.12), transparent 65%)," +
      "var(--advisor-canvas)",
  },

  blobTop: {
    position: "absolute",
    top: "-120px",
    right: "-80px",
    width: "480px",
    height: "480px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(29,171,137,0.12) 0%, transparent 70%)",
    pointerEvents: "none",
  },

  blobBottom: {
    position: "absolute",
    bottom: "-140px",
    left: "-100px",
    width: "560px",
    height: "560px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(22,41,68,0.10) 0%, transparent 70%)",
    pointerEvents: "none",
  },

  wrapper: {
    width: "100%",
    maxWidth: "420px",
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px",
    transform: "translateY(-30px)",
  },
  contentWrap: {
    width: "100%",
  },

  /* Brand header */
  brandHeader: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    textAlign: "center" as const,
  },
  logoWrap: {
    width: "136px",
    height: "136px",
    flexShrink: 0,
    lineHeight: 0,
  },
  logoText: {
    fontSize: "42px",
    fontWeight: "700",
    color: "var(--advisor-primary)",
    fontFamily: "'Playfair Display', Georgia, serif",
    letterSpacing: "0.01em",
    lineHeight: "1.1",
  },
  /* Card */
  card: {
    width: "100%",
    borderRadius: "20px",
    background: "#ffffff",
    border: "1px solid var(--advisor-border)",
    boxShadow: "0 20px 60px rgba(16,32,51,0.12), 0 4px 16px rgba(16,32,51,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
    overflow: "hidden",
  },

  cardHeader: {
    padding: "28px 28px 0",
    textAlign: "center" as const,
  },

  cardTitle: {
    fontSize: "22px",
    fontWeight: "700",
    color: "var(--advisor-primary)",
    fontFamily: "'Playfair Display', Georgia, serif",
    letterSpacing: "0.01em",
    marginBottom: "6px",
  },

  cardSubtitle: {
    fontSize: "13px",
    color: "var(--text-secondary)",
    lineHeight: "1.5",
  },

  /* Tabs */
  tabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "4px",
    margin: "24px 28px 0",
    padding: "4px",
    background: "rgba(22,41,68,0.05)",
    borderRadius: "12px",
    border: "1px solid var(--advisor-border)",
  },

  tab: {
    padding: "9px 0",
    border: "none",
    borderRadius: "9px",
    background: "transparent",
    color: "var(--text-secondary)",
    fontSize: "13px",
    fontWeight: "500",
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "all 0.18s ease",
  } as React.CSSProperties,

  tabActive: {
    background: "#ffffff",
    color: "var(--advisor-primary)",
    fontWeight: "600",
    boxShadow: "0 2px 8px rgba(16,32,51,0.10)",
  } as React.CSSProperties,

  /* Form */
  form: {
    padding: "24px 28px 28px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
  },

  fieldGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0px",
  },
  passwordWrap: {
    position: "relative" as const,
  },
  passwordInput: {
    paddingRight: "86px",
  },
  passwordToggle: {
    position: "absolute" as const,
    top: "50%",
    right: "10px",
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    color: "var(--advisor-primary)",
    fontSize: "0",
    lineHeight: 1,
    cursor: "pointer",
    padding: "4px",
    opacity: 0.8,
  },

  /* Footer */
  footer: {
    textAlign: "center" as const,
  },

  footerText: {
    fontSize: "12px",
    color: "var(--text-muted)",
  },
};
