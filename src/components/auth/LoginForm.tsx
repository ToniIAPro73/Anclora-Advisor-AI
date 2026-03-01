"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppPreferences } from "@/components/providers/AppPreferencesProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

interface LoginFormProps {
  nextPath: string;
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const { resolvedTheme } = useAppPreferences();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isLight = resolvedTheme === "light";

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
    <main style={{ ...styles.main, ...(isLight ? styles.mainLight : styles.mainDark) }}>
      {/* Background decorative blobs */}
      <div style={{ ...styles.blobTop, ...(isLight ? styles.blobTopLight : styles.blobTopDark) }} aria-hidden="true" />
      <div style={{ ...styles.blobBottom, ...(isLight ? styles.blobBottomLight : styles.blobBottomDark) }} aria-hidden="true" />

      <div style={styles.wrapper}>
        {/* Brand header */}
        <header style={styles.brandHeader}>
          <div style={{ ...styles.logoWrap, ...(isLight ? styles.logoWrapLight : styles.logoWrapDark) }}>
            <Image
              src={isLight ? "/brand/logo-Advisor.png" : "/brand/Logo-Advisor_1.png"}
              alt="Logo de Anclora Advisor"
              width={84}
              height={84}
              priority
              style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
            />
          </div>
          <span style={{ ...styles.logoText, ...(isLight ? styles.logoTextLight : styles.logoTextDark) }}>Anclora Advisor AI</span>
        </header>

        <div style={styles.contentWrap}>
          {/* Card */}
          <section style={{ ...styles.card, ...(isLight ? styles.cardLight : styles.cardDark) }} aria-label="Formulario de acceso">
            <div style={styles.cardHeader}>
              <h1 style={{ ...styles.cardTitle, ...(isLight ? styles.cardTitleLight : styles.cardTitleDark) }}>
                {mode === "login" ? "Bienvenido de nuevo" : "Crear cuenta"}
              </h1>
              <p style={styles.cardSubtitle}>
                {mode === "login"
                  ? "Accede a tu asesoramiento fiscal y laboral"
                  : "Empieza a gestionar tu actividad como autónomo"}
              </p>
            </div>

            {/* Mode tabs */}
            <div style={{ ...styles.tabs, ...(isLight ? styles.tabsLight : styles.tabsDark) }} role="tablist">
              <button
                id="tab-login"
                role="tab"
                type="button"
                aria-selected={mode === "login"}
                aria-controls="panel-form"
                onClick={() => { setMode("login"); setError(null); setMessage(null); }}
                style={{ ...styles.tab, ...(mode === "login" ? (isLight ? styles.tabActiveLight : styles.tabActiveDark) : {}) }}
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
                style={{ ...styles.tab, ...(mode === "signup" ? (isLight ? styles.tabActiveLight : styles.tabActiveDark) : {}) }}
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
                  className="advisor-input login-auth-input"
                  placeholder="usuario@anclora.es"
                  required
                  style={isLight ? styles.loginInputLight : styles.loginInputDark}
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
                    className="advisor-input login-auth-input"
                    placeholder={mode === "login" ? "Tu contraseña" : "Mínimo 6 caracteres"}
                    required
                    minLength={6}
                    style={{ ...styles.passwordInput, ...(isLight ? styles.loginInputLight : styles.loginInputDark) }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    style={{ ...styles.passwordToggle, ...(isLight ? styles.passwordToggleLight : styles.passwordToggleDark) }}
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
  },
  mainDark: {
    background:
      "radial-gradient(1400px 700px at 15% -10%, rgba(29,171,137,0.10), transparent 65%)," +
      "radial-gradient(1200px 600px at 95% 100%, rgba(22,41,68,0.12), transparent 65%)," +
      "var(--advisor-canvas)",
  },
  mainLight: {
    background:
      "radial-gradient(1200px 640px at 10% -10%, rgba(29,171,137,0.12), transparent 68%)," +
      "radial-gradient(980px 520px at 100% 0%, rgba(22,41,68,0.10), transparent 70%)," +
      "linear-gradient(180deg, #eef4fb 0%, #f8fbff 46%, #e8eef8 100%)",
  },

  blobTop: {
    position: "absolute",
    top: "-120px",
    right: "-80px",
    width: "480px",
    height: "480px",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  blobTopDark: {
    background: "radial-gradient(circle, rgba(29,171,137,0.12) 0%, transparent 70%)",
  },
  blobTopLight: {
    background: "radial-gradient(circle, rgba(255,255,255,0.52) 0%, rgba(255,255,255,0) 72%)",
  },

  blobBottom: {
    position: "absolute",
    bottom: "-140px",
    left: "-100px",
    width: "560px",
    height: "560px",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  blobBottomDark: {
    background: "radial-gradient(circle, rgba(22,41,68,0.10) 0%, transparent 70%)",
  },
  blobBottomLight: {
    background: "radial-gradient(circle, rgba(22,41,68,0.14) 0%, transparent 72%)",
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
  logoWrapDark: {
    filter: "drop-shadow(0 14px 26px rgba(3, 8, 18, 0.28))",
  },
  logoWrapLight: {
    filter: "drop-shadow(0 16px 28px rgba(20, 40, 65, 0.12))",
  },
  logoText: {
    fontSize: "42px",
    fontWeight: "700",
    fontFamily: "'Playfair Display', Georgia, serif",
    letterSpacing: "0.01em",
    lineHeight: "1.1",
  },
  logoTextDark: {
    color: "#e8eef8",
    textShadow: "0 12px 26px rgba(3, 8, 18, 0.24)",
  },
  logoTextLight: {
    color: "#162944",
    textShadow: "0 10px 22px rgba(255,255,255,0.58)",
  },
  /* Card */
  card: {
    width: "100%",
    borderRadius: "20px",
    overflow: "hidden",
  },
  cardDark: {
    background: "linear-gradient(180deg, rgba(19, 33, 51, 0.96) 0%, rgba(15, 27, 43, 0.98) 100%)",
    border: "1px solid rgba(161, 219, 198, 0.18)",
    boxShadow: "0 24px 64px rgba(3, 8, 18, 0.34), inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  cardLight: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,250,255,0.98) 100%)",
    border: "1px solid rgba(22, 41, 68, 0.10)",
    boxShadow: "0 20px 60px rgba(16,32,51,0.12), 0 4px 16px rgba(16,32,51,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
  },

  cardHeader: {
    padding: "28px 28px 0",
    textAlign: "center" as const,
  },

  cardTitle: {
    fontSize: "22px",
    fontWeight: "700",
    fontFamily: "'Playfair Display', Georgia, serif",
    letterSpacing: "0.01em",
    marginBottom: "6px",
  },
  cardTitleDark: {
    color: "#f3f7fd",
  },
  cardTitleLight: {
    color: "var(--advisor-primary)",
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
    borderRadius: "12px",
  },
  tabsDark: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(161, 219, 198, 0.14)",
  },
  tabsLight: {
    background: "rgba(22,41,68,0.05)",
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

  tabActiveDark: {
    background: "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(161,219,198,0.10))",
    color: "#f4f8fd",
    fontWeight: "600",
    boxShadow: "0 8px 18px rgba(3, 8, 18, 0.22)",
  } as React.CSSProperties,

  tabActiveLight: {
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
  loginInputDark: {
    background: "linear-gradient(180deg, rgba(35, 51, 72, 0.96) 0%, rgba(29, 44, 63, 0.98) 100%)",
    borderColor: "rgba(161, 219, 198, 0.12)",
    color: "#f3f7fd",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 22px rgba(3, 8, 18, 0.16)",
  },
  loginInputLight: {
    background: "color-mix(in srgb, var(--advisor-panel) 92%, #ffffff)",
  },
  passwordToggle: {
    position: "absolute" as const,
    top: "50%",
    right: "10px",
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    fontSize: "0",
    lineHeight: 1,
    cursor: "pointer",
    padding: "4px",
  },
  passwordToggleDark: {
    color: "#bfd0e7",
    opacity: 0.9,
  },
  passwordToggleLight: {
    color: "var(--advisor-primary)",
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
