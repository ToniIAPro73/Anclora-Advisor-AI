// src/components/features/disclaimer/AiIndicatorBadge.tsx
"use client";

import React from "react";
import type { LocaleCode } from "@/lib/i18n/messages";
import { DISCLAIMER_TEXTS } from "./disclaimer-texts";

interface AiIndicatorBadgeProps {
  locale: LocaleCode;
}

/**
 * Persistent visual indicator that responses are AI-generated.
 * Visible throughout the active session (Req 2.3).
 */
export const AiIndicatorBadge: React.FC<AiIndicatorBadgeProps> = ({
  locale,
}) => {
  const texts = DISCLAIMER_TEXTS[locale];

  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{
        borderColor: "color-mix(in srgb, #8b5cf6 30%, var(--advisor-border))",
        background:
          "color-mix(in srgb, #8b5cf6 10%, var(--advisor-panel-muted))",
        color: "#8b5cf6",
      }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: "#8b5cf6" }}
        aria-hidden="true"
      />
      {texts.aiIndicator}
    </span>
  );
};
