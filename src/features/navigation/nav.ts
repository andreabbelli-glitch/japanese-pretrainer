export type NavItem = {
  href:
    | "/"
    | "/media"
    | "/glossary"
    | "/consolidation"
    | "/review"
    | "/kanji-clash"
    | "/katakana-speed"
    | "/pitch-accent"
    | "/settings";
  label: string;
  description: string;
};

export const primaryNav: NavItem[] = [
  {
    href: "/",
    label: "Home",
    description: "Continua a studiare"
  },
  {
    href: "/media",
    label: "Media",
    description: "I tuoi media"
  },
  {
    href: "/glossary",
    label: "Glossary",
    description: "Consulta le voci"
  },
  {
    href: "/consolidation",
    label: "Consolidamento",
    description: "Prima della review"
  },
  {
    href: "/review",
    label: "Review",
    description: "Ripasso di oggi"
  },
  {
    href: "/kanji-clash",
    label: "Kanji Clash",
    description: "Confronta kanji simili"
  },
  {
    href: "/katakana-speed",
    label: "Katakana",
    description: "Velocità kana"
  },
  {
    href: "/pitch-accent",
    label: "Pitch",
    description: "Minimal pairs"
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Preferenze"
  }
];

export function shouldPrefetchPrimaryNavHref(href: NavItem["href"]) {
  return href === "/review";
}

export function resolveActivePrimaryNavHref(pathname: string): NavItem["href"] {
  if (pathname === "/" || pathname.length === 0) {
    return "/";
  }

  if (pathname === "/consolidation" || pathname.startsWith("/consolidation/")) {
    return "/consolidation";
  }

  if (
    pathname === "/review" ||
    pathname.startsWith("/review/") ||
    /^\/media\/[^/]+\/review(?:\/|$)/.test(pathname)
  ) {
    return "/review";
  }

  if (pathname === "/kanji-clash" || pathname.startsWith("/kanji-clash/")) {
    return "/kanji-clash";
  }

  if (
    pathname === "/katakana-speed" ||
    pathname.startsWith("/katakana-speed/")
  ) {
    return "/katakana-speed";
  }

  if (pathname === "/pitch-accent" || pathname.startsWith("/pitch-accent/")) {
    return "/pitch-accent";
  }

  if (pathname === "/glossary" || pathname.startsWith("/glossary/")) {
    return "/glossary";
  }

  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return "/settings";
  }

  if (pathname === "/media" || pathname.startsWith("/media/")) {
    return "/media";
  }

  return "/";
}
