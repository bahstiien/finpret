"use client";

import { useEffect } from "react";
import { recordProgressEvent } from "@/server/actions/progress";

/** Enregistre l'ouverture de « Nos progrès » (une fois par affichage, SPEC_PROGRES §7). */
export function ProgressViewed({ from }: { from: "tile" | "profile" | "session" }) {
  useEffect(() => {
    void recordProgressEvent({ name: "progress_viewed", from });
  }, [from]);
  return null;
}
