"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function CopyInviteButton({ inviteLink }: { inviteLink: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button onClick={handleCopy} variant="secondary">
      {copied ? "Link copied" : "Copy invite link"}
    </Button>
  );
}
