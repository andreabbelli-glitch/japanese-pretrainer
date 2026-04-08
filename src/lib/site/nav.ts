export type NavItem = {
  href: "/" | "/media" | "/glossary" | "/review" | "/kanji-clash" | "/settings";
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
    href: "/settings",
    label: "Settings",
    description: "Preferenze"
  }
];

export function resolveActivePrimaryNavHref(pathname: string): NavItem["href"] {
  if (pathname === "/" || pathname.length === 0) {
    return "/";
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
    pathname === "/glossary" ||
    pathname.startsWith("/glossary/") ||
    /^\/media\/[^/]+\/glossary(?:\/|$)/.test(pathname)
  ) {
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
