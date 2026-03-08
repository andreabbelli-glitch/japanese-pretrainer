import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/lessons", label: "Lezioni" },
  { href: "/items", label: "Item" },
  { href: "/cards", label: "Carte" },
  { href: "/decks", label: "Mazzi" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/review", label: "Review" },
  { href: "/settings", label: "Impostazioni" },
];

export function MainNav() {
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap gap-3 px-4 py-3 text-sm">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="rounded-md px-2 py-1 hover:bg-slate-100">
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
