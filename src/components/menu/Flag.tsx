"use client";

import { useSyncExternalStore } from "react";
import type { Flag as FlagData } from "@/server/menu-view";

const isWindows = () => /Windows/.test(navigator.userAgent);

/** Drapeau emoji, avec repli en badge du code pays sous Windows, qui n'affiche pas les drapeaux (§11). */
export function Flag({ flag }: { flag: FlagData }) {
  const windows = useSyncExternalStore(
    () => () => {},
    isWindows,
    () => false,
  );
  if (!flag) return null;
  if (windows && flag.emoji !== "🌏") {
    return (
      <abbr
        title={flag.name}
        className="mr-1 mono inline-grid h-5 min-w-7 place-items-center rounded-r1 border-[length:var(--bw)] border-line bg-chip px-1 align-[0.1em] text-xs font-bold no-underline"
      >
        {flag.code.toUpperCase()}
      </abbr>
    );
  }
  return (
    <span role="img" aria-label={flag.name} className="mr-1">
      {flag.emoji}
    </span>
  );
}
