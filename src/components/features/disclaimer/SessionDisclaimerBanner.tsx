// src/components/features/disclaimer/SessionDisclaimerBanner.tsx
"use client";

import React from "react";
import type { LocaleCode } from "@/lib/i18n/messages";
import { DISCLAIMER_TEXTS } from "./disclaimer-texts";

interface SessionDisclaimerBannerProps {
  locale: LocaleCode;
}

/**
 * Conversational disclaimer injected as the first message in every new chat session.
 * Fulfills EU AI Act Art. 50 transparency requirement (Req 2.1, 2.2).
 */
export const SessionDisclaimerBanner: React.FC<
  SessionDisclaimerBannerProps
> = ({ locale }) => {
  const texts = DISCLAIMER_TEXTS[locale];

  return (
    <div
      role="status"
      aria-label={texts.sessionBannerTitle}
      className="mx-auto mb-4 max-w-3xl rounded-xl border px-4 py-3 shadow-sm"
      style={{
        borderColor: "color-mix(in srgb, #3b82f6 30%, var(--advisor-border))",
        background:
          "color-mix(in srgb, #3b82f6 8%, var(--advisor-panel-muted))",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{
            background: "color-mix(in srgb, #3b82f6 20%, transparent)",
            color: "#3b82f6",
          }}
          aria-hidden="true"
        >
          ℹ
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "#3b82f6" }}
          >
            {texts.sessionBannerTitle}
          </p>
          <p
            className="mt-1 text-sm leading-relaxed"
            style={{ color: "var(--text-primary)" }}
          >
            {texts.sessionBanner}
          </p>
        </div>
      </div>
    </div>
  );
};
