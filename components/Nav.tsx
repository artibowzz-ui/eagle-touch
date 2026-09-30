import { APP_URL } from "@/lib/season";
import { LinkButton } from "./LinkButton";

const links = [
  { href: "#fonctionnement", label: "Fonctionnement" },
  { href: "#moyenne", label: "Classement" },
  { href: "#defis", label: "Défis" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-6 px-4 md:px-8">
        <a href="#" className="text-[17px] font-semibold tracking-[-0.02em]">
          Eagle Touch
        </a>
        <nav aria-label="Sections" className="hidden items-center gap-8 text-sm text-ink-2 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>
        <LinkButton href={APP_URL} size="sm">
          Connectez-vous
        </LinkButton>
      </div>
    </header>
  );
}
