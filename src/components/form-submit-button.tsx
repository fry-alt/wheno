"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function FormSubmitButton({
  label,
  pendingLabel,
  fullWidth = true,
}: {
  label: string;
  pendingLabel: string;
  fullWidth?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} fullWidth={fullWidth} type="submit">
      {pending ? pendingLabel : label}
    </Button>
  );
}
