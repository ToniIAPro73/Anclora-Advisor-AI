// src/components/features/disclaimer/LegalRecommendationFooter.tsx
"use client";

import React from "react";
import type { LocaleCode } from "@/lib/i18n/messages";
import { DISCLAIMER_TEXTS } from "./disclaimer-texts";

interface LegalRecommendationFooterProps {
  locale: LocaleCode;
}

/**
 * Disclaimer footer appended to legal/fiscal recommendation responses.
 * States that the response does not constitute professional legal advice (Req 2.4).
 */
export const LegalRecommendationFooter: React.FC<
  LegalRecommendationFooterProps
> = ({ locale }) => {
  const texts = DISCLAIMER_TEXTS[locale];

  return (
    <div
      role="note"
      aria-label={
        locale === "es"
          ? "Descargo de responsabilidad legal"
          : "Legal disclaimer"
      }
      className="mt-3 rounded-lg border px-3 py-2"
      style={{
        borderColor: "color-mix(in srgb, #f59e0b 30%, var(--advisor-border))",
        background:
          "color-mix(in srgb, #f59e0b 6%, var(--advisor-panel-muted))",
      }}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 shrink-0 text-sm"
          style={{ color: "#f59e0b" }}
          aria-hidden="true"
        >
          ⚠
        </span>
        <p
          className="text-xs leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {texts.legalFooter}
        </p>
      </div>
    </div>
  );
};
