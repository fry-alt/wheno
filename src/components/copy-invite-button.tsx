"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function CopyInviteButton({
  inviteLink,
  labels,
}: {
  inviteLink: string;
  labels: {
    defaultLabel: string;
    copiedLabel: string;
    unavailableLabel: string;
    shareLabel: string;
  };
}) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink);
        setState("copied");
        window.setTimeout(() => setState("idle"), 2000);
        return;
      }

      if (navigator.share) {
        await navigator.share({ url: inviteLink });
        return;
      }

      setState("error");
    } catch {
      if (navigator.share) {
        try {
          await navigator.share({ url: inviteLink });
          return;
        } catch {
          setState("error");
        }
      } else {
        setState("error");
      }
    }
  }

  const label =
    state === "copied"
      ? labels.copiedLabel
      : state === "error"
        ? labels.unavailableLabel
        : labels.defaultLabel;

  return (
    <Button onClick={handleCopy} variant="secondary">
      {label}
    </Button>
  );
}
