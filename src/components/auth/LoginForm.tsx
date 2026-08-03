"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppPreferences } from "@/components/providers/AppPreferencesProvider";
import { uiText } from "@/lib/i18n/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup" | "forgot" | "reset";

interface LoginFormProps {
  nextPath: string;
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const { resolvedTheme, locale } = useAppPreferences();
  const ui = (key: string) => uiText(locale, key);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isLight = resolvedTheme === "light";

  useEffect(() => {
    const syncRecoveredSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await syncServerSession(data.session.access_token).catch(() => undefined);
      }
    };

    const search = new URLSearchParams(window.location.search);
    if (search.get("mode") === "reset") {
      setMode("reset");
      setMessage("Introduce tu nueva contraseña para completar la recuperación.");
      void syncRecoveredSession();
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
        setError(null);
        setMessage("Introduce tu nueva contraseña para completar la recuperación.");
        if (session?.access_token) {
          void syncServerSession(session.access_token).catch(() => undefined);
        }
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

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
      if (mode === "forgot") {
        const redirectTo = `${window.location.origin}/login?mode=reset`;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (resetError) {
          throw new Error(resetError.message);
        }
        setMessage("Te hemos enviado un enlace para restablecer tu contraseña.");
        return;
      }

      if (mode === "reset") {
        if (password.length < 6) {
          throw new Error("La nueva contraseña debe tener al menos 6 caracteres.");
        }
        if (password !== confirmPassword) {
          throw new Error("Las contraseñas no coinciden.");
        }

        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) {
          throw new Error(updateError.message);
        }

        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await syncServerSession(data.session.access_token);
        }

        setMessage("Contraseña actualizada. Ya puedes entrar al dashboard.");
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        return;
      }

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
    <main className="relative flex min-h-screen items-center justify-center overflow-y-auto p-4 sm:p-6"
      style={isLight
        ? { background: 'radial-gradient(1200px 640px at 10% -10%, rgba(29,171,137,0.10), transparent 68%), linear-gradient(180deg, #eef4fb 0%, #f8fbff 46%, #e8eef8 100%)' }
        : { background: 'radial-gradient(1200px 640px at 10% -10%, rgba(29,171,137,0.10), transparent 68%), linear-gradient(135deg, rgba(2,6,18,1) 0%, rgba(10,22,35,0.98) 50%, rgba(5,15,28,0.96) 100%)' }
      }>

      <div className="relative w-full max-w-[460px] mx-auto">
          {/* Card */}
          <section
            className="login-card-elevation"
            style={{
              width: '100%',
              minHeight: 560,
              borderRadius: '24px',
              background: isLight
                ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,250,255,0.98) 100%)'
                : 'rgba(5,15,28,0.88)',
              border: isLight ? '1px solid rgba(22,41,68,0.10)' : '1px solid rgba(29,171,137,0.12)',
              boxShadow: isLight
                ? '0 32px 80px -40px rgba(29,171,137,0.25)'
                : '0 32px 80px -40px rgba(29,171,137,0.35)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
            aria-label="Formulario de acceso"
          >
            {/* Logo 50px sin contenedor — igual que Impulso BrandLogo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 32, paddingBottom: 20 }}>
              <Image
                src="/brand/anclora-advisor-ai.png"
                alt="Logo de Anclora Advisor"
                width={50}
                height={50}
                priority
                style={{
                  objectFit: 'contain',
                  marginBottom: 8,
                  filter: isLight
                    ? 'drop-shadow(0 12px 24px rgba(16,32,51,0.14))'
                    : 'drop-shadow(0 12px 24px rgba(3,8,18,0.32))',
                }}
              />
              <div style={{ width: 50, height: 1, background: isLight ? 'linear-gradient(90deg, transparent, rgba(22,41,68,0.40), transparent)' : 'linear-gradient(90deg, transparent, rgba(29,171,137,0.60), transparent)', marginBottom: 6 }} aria-hidden="true" />
              <span style={{ fontSize: 14, fontWeight: 700, color: isLight ? '#162944' : '#f3f7fd', letterSpacing: '0.01em' }}>
                Anclora Advisor AI
              </span>
            </div>


            {/* Form */}
            <form id="panel-form" role="tabpanel" onSubmit={handleSubmit} style={styles.form} noValidate>
              <div style={styles.fieldGroup}>
                <label htmlFor="email" className="advisor-label" style={{ fontSize: 12 }}>
                  {ui("auth.email")}
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
                  style={{ ...(isLight ? styles.loginInputLight : styles.loginInputDark), height: 40, padding: '0 14px' }}
                />
              </div>

              {mode !== "forgot" && (
                <div style={styles.fieldGroup}>
                <label htmlFor="password" className="advisor-label" style={{ fontSize: 12 }}>
                  {mode === "reset" ? ui("auth.newPasswordLabel") : ui("auth.password")}
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
                    style={{ ...styles.passwordInput, ...(isLight ? styles.loginInputLight : styles.loginInputDark), height: 40, padding: '0 44px 0 14px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? ui("auth.hidePassword") : ui("auth.showPassword")}
                    title={showPassword ? ui("auth.hidePassword") : ui("auth.showPassword")}
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
              )}

              {mode === "reset" && (
                <div style={styles.fieldGroup}>
                  <label htmlFor="confirmPassword" className="advisor-label">
                    {ui("auth.confirmPassword")}
                  </label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="advisor-input login-auth-input"
                    placeholder="Repite tu nueva contraseña"
                    required
                    minLength={6}
                    style={isLight ? styles.loginInputLight : styles.loginInputDark}
                  />
                </div>
              )}

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
                style={{ marginTop: 4, height: 40, fontSize: 14 }}
              >
                {loading ? (
                  <>
                    <span className="advisor-spinner" aria-hidden="true" />
                    {ui("auth.processing")}
                  </>
                ) : (
                  mode === "login"
                    ? ui("auth.signIn")
                    : mode === "signup"
                      ? ui("auth.signUp")
                      : mode === "forgot"
                        ? ui("auth.sendResetLink")
                        : ui("auth.saveNewPassword")
                )}
              </button>
            </form>
            {/* Forgot password — centered, below button (login mode) */}
            {mode === "login" && (
              <div style={{ textAlign: 'center', padding: '10px 24px 0' }}>
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setError(null); setMessage(null); setPassword(""); }}
                  style={{ ...styles.linkButton, ...(isLight ? styles.linkButtonLight : styles.linkButtonDark), fontSize: 12 }}
                >
                  {ui("auth.forgotPassword")}
                </button>
              </div>
            )}

            {/* Back to sign in — forgot/reset modes */}
            {(mode === "forgot" || mode === "reset") && (
              <div style={{ textAlign: 'center', padding: '10px 24px 0' }}>
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(null); setMessage(null); setPassword(""); setConfirmPassword(""); }}
                  style={{ ...styles.linkButton, ...(isLight ? styles.linkButtonLight : styles.linkButtonDark), fontSize: 12 }}
                >
                  {ui("auth.backToSignIn")}
                </button>
              </div>
            )}

            {/* No account / Already have account box — matching Impulso */}
            {(mode === "login" || mode === "signup") && (
              <div style={{
                margin: '6px 24px 0',
                borderRadius: 16,
                border: isLight ? '1px solid rgba(22,41,68,0.08)' : '1px solid rgba(29,171,137,0.08)',
                background: isLight ? 'rgba(255,255,255,0.5)' : 'rgba(5,15,28,0.50)',
                padding: '8px 16px',
                textAlign: 'center',
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}>
                {mode === "login" ? (
                  <>
                    {ui("auth.noAccount")}{" "}
                    <button type="button" onClick={() => { setMode("signup"); setError(null); setMessage(null); }}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--advisor-accent)' }}>
                      {ui("auth.signUp")}
                    </button>
                  </>
                ) : (
                  <>
                    {ui("auth.alreadyAccount")}{" "}
                    <button type="button" onClick={() => { setMode("login"); setError(null); setMessage(null); }}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--advisor-accent)' }}>
                      {ui("auth.signIn")}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Social login — disabled (OAuth not configured) */}
            <div style={{ padding: '12px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--advisor-border)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>
                  {ui("auth.socialAccess")}
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--advisor-border)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button disabled style={{ height: 36, border: '1px solid var(--advisor-border)', borderRadius: 10, fontSize: 12, fontFamily: 'inherit', color: 'var(--text-secondary)', opacity: 0.5, cursor: 'not-allowed', background: 'transparent' }} title={ui("auth.socialComingSoon")}>Google</button>
                <button disabled style={{ height: 36, border: '1px solid var(--advisor-border)', borderRadius: 10, fontSize: 12, fontFamily: 'inherit', color: 'var(--text-secondary)', opacity: 0.5, cursor: 'not-allowed', background: 'transparent' }} title={ui("auth.socialComingSoon")}>GitHub</button>
              </div>
            </div>

            {/* Legal notice — always at the end */}
            <p style={styles.cardLegal}>
              {ui("auth.legalPrefix")}{" "}
              <Link href="/terms" style={styles.cardLegalLink}>{ui("auth.terms")}</Link>
              {" "}{ui("auth.legalMiddle")}{" "}
              <Link href="/privacy" style={styles.cardLegalLink}>{ui("auth.privacy")}</Link>
              {ui("auth.legalSuffix")}
            </p>
          </section>
      </div>
    </main>
  );
}

/* ── Inline styles (layout only, no theming) ─────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  contentWrap: {
    width: "100%",
  },

  /* Brand header */
  brandHeader: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    textAlign: "center" as const,
  },
  logoWrap: {
    width: "96px",
    height: "64px",
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
    fontSize: "40px",
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
    margin: "0 24px 0",
    padding: "3px",
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
    padding: "4px 24px 20px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },
  inlineActions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "-4px",
  },
  linkButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
  },
  linkButtonDark: {
    color: "#9ed7c5",
  },
  linkButtonLight: {
    color: "var(--advisor-primary)",
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
  divisorLight: {
    width: "64px",
    height: "1px",
    background: "linear-gradient(90deg, transparent, rgba(22,41,68,0.30), transparent)",
    margin: "8px auto 6px",
  } as React.CSSProperties,
  divisorDark: {
    width: "64px",
    height: "1px",
    background: "linear-gradient(90deg, transparent, rgba(161,219,198,0.40), transparent)",
    margin: "8px auto 6px",
  } as React.CSSProperties,
  cardLegal: {
    padding: "12px 24px 24px",
    fontSize: "11px",
    lineHeight: "1.6",
    textAlign: "center" as const,
    color: "var(--text-muted)",
  },
  cardLegalLink: {
    color: "var(--advisor-accent)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
};
