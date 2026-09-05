"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

type IntentLinkProps = Omit<ComponentProps<typeof Link>, "prefetch">;

/** Warm the chosen destination without loading every visible card or filter. */
export function IntentLink({
  href,
  onFocus,
  onMouseEnter,
  onTouchStart,
  ...props
}: IntentLinkProps) {
  const [intentHref, setIntentHref] = useState<IntentLinkProps["href"] | null>(
    null
  );

  return (
    <Link
      {...props}
      href={href}
      prefetch={intentHref === href}
      onFocus={(event) => {
        onFocus?.(event);
        setIntentHref(href);
      }}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        setIntentHref(href);
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event);
        setIntentHref(href);
      }}
    />
  );
}
