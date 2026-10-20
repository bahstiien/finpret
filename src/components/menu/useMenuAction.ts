"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ui/Toast";

type Result = { ok: true; data: { message: string } } | { ok: false; error: string };

/** Lance une action du Menu et affiche son message (ou son erreur) dans un toast. */
export function useMenuAction() {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<Result>, after?: () => void) =>
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        toast(res.data.message);
        after?.();
      } else toast(res.error, "error");
    });
  return { run, pending };
}
