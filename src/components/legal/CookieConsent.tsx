"use client";

import { useEffect, useState } from "react";

type CookiePreferences = {
  necessary: true;
  session: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
  version: "v1";
};

const STORAGE_KEY = "anclora-cookie-consent-v1";
const defaults: CookiePreferences = {
  necessary: true,
  session: true,
  analytics: false,
  marketing: false,
  updatedAt: "",
  version: "v1",
};

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(defaults);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CookiePreferences>;
        setPreferences({
          necessary: true,
          session: true,
          analytics: Boolean(parsed.analytics),
          marketing: Boolean(parsed.marketing),
          updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
          version: "v1",
        });
        return;
      }
    } catch {}
    setOpen(true);
  }, []);

  useEffect(() => {
    const listener = () => {
      setOpen(true);
      setSettings(true);
    };
    window.addEventListener("anclora:open-cookie-preferences", listener);
    return () => window.removeEventListener("anclora:open-cookie-preferences", listener);
  }, []);

  function persist(next: CookiePreferences) {
    const value = { ...next, necessary: true as const, session: true as const, updatedAt: new Date().toISOString(), version: "v1" as const };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    setPreferences(value);
    setOpen(false);
    setSettings(false);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Preferencias de cookies"
        onClick={() => {
          setOpen(true);
          setSettings(true);
        }}
        className="fixed bottom-5 left-5 z-50 flex h-11 w-11 items-center justify-center rounded-full border shadow-xl backdrop-blur transition hover:-translate-y-0.5"
        style={{
          borderColor: "color-mix(in srgb, var(--advisor-accent) 45%, transparent)",
          background: "color-mix(in srgb, var(--advisor-panel) 92%, transparent)",
          color: "var(--advisor-accent)",
        }}
      >
        <span aria-hidden="true">C</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 py-6 backdrop-blur-sm sm:items-center" style={{ background: "rgba(3, 10, 18, 0.58)" }} role="dialog" aria-modal="true" aria-labelledby="advisor-cookie-title">
          <div className="w-full max-w-lg rounded-3xl border p-6 shadow-2xl" style={{ borderColor: "var(--advisor-border)", background: "var(--advisor-panel)", color: "var(--text-primary)" }}>
            {!settings ? (
              <div className="space-y-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--advisor-accent)" }}>Anclora Group</p>
                  <h2 id="advisor-cookie-title" className="advisor-heading mt-2 text-2xl">Preferencias de cookies</h2>
                  <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>Usamos cookies necesarias para sesión, seguridad e idioma. Las opciones de análisis operativo o marketing no se activan por defecto.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={() => persist({ ...defaults, analytics: true, marketing: true })} className="advisor-btn advisor-btn-primary">Aceptar todas</button>
                  <button type="button" onClick={() => setSettings(true)} className="advisor-btn advisor-btn-secondary">Configuración</button>
                  <button type="button" onClick={() => persist(defaults)} className="advisor-btn advisor-btn-secondary">Rechazar opcionales</button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <h2 id="advisor-cookie-title" className="advisor-heading text-2xl">Gestionar cookies</h2>
                <div className="space-y-3">
                  <CookieRow title="Cookies necesarias" description="Funcionamiento básico, seguridad, idioma y preferencias. No se pueden desactivar." checked disabled onChange={() => {}} />
                  <CookieRow title="Sesión y autenticación" description="Mantienen el acceso al dashboard y protegen la cuenta." checked disabled onChange={() => {}} />
                  <CookieRow title="Análisis operativo" description="Ayudan a mejorar estabilidad y flujos internos cuando exista instrumentación." checked={preferences.analytics} onChange={(analytics) => setPreferences((current) => ({ ...current, analytics }))} />
                  <CookieRow title="Marketing" description="Reservadas para comunicaciones relevantes. No activan scripts inexistentes." checked={preferences.marketing} onChange={(marketing) => setPreferences((current) => ({ ...current, marketing }))} />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <button type="button" onClick={() => setSettings(false)} className="advisor-btn advisor-btn-secondary">Volver</button>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button type="button" onClick={() => persist(defaults)} className="advisor-btn advisor-btn-secondary">Rechazar opcionales</button>
                    <button type="button" onClick={() => persist(preferences)} className="advisor-btn advisor-btn-primary">Guardar preferencias</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function CookieRow({ title, description, checked, disabled, onChange }: { title: string; description: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl border p-4" style={{ borderColor: "var(--advisor-border)", background: "color-mix(in srgb, var(--advisor-panel) 88%, var(--advisor-light))" }}>
      <span>
        <span className="block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</span>
        <span className="mt-1 block text-xs leading-5" style={{ color: "var(--text-secondary)" }}>{description}</span>
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-5 w-5" />
    </label>
  );
}
