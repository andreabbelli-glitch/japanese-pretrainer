"use client";

import { useFormStatus } from "react-dom";

export function ApplyFsrsRescheduleButton({
  disabled
}: {
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      aria-disabled={isDisabled}
      className="button button--primary"
      disabled={isDisabled}
      type="submit"
    >
      {pending ? "Riallineamento..." : "Applica riallineamento FSRS"}
    </button>
  );
}
