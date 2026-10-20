import { LEGAL } from "@/lib/legal";
import { APP_URL } from "@/lib/season";

/* Mise en page commune des pages légales (confidentialité, conditions, licences). */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8">
      <h2 className="text-xl font-semibold tracking-[-0.02em]">{title}</h2>
      <div className="mt-3 space-y-3 text-ink-2 [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}

export function ContactMail() {
  return LEGAL.email.includes("@") ? (
    <a className="underline underline-offset-4" href={`mailto:${LEGAL.email}`}>
      {LEGAL.email}
    </a>
  ) : (
    <>{LEGAL.email}</>
  );
}

export const LEGAL_LINKS = [
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/conditions", label: "Conditions d'utilisation" },
  { href: "/licences", label: "Licences" },
];

export function LegalPage({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro: React.ReactNode;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-line/70">
        <div className="mx-auto flex h-16 max-w-[820px] items-center justify-between px-4 md:px-8">
          <a href="/" className="text-[17px] font-semibold tracking-[-0.02em]">
            Eagle Touch
          </a>
          <a href={APP_URL} className="text-sm font-medium underline decoration-line decoration-2 underline-offset-[6px]">
            Ouvrir l&apos;application
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-[820px] px-4 pb-20 pt-10 leading-relaxed md:px-8 md:pt-16">
        <h1 className="text-[2rem] leading-[1.08] font-semibold tracking-[-0.035em] md:text-5xl">{title}</h1>
        <div className="mt-4 max-w-[62ch] text-ink-2">{intro}</div>
        <p className="mt-2 text-sm text-ink-3">Dernière mise à jour : {updated}</p>
        <div className="mt-10">{children}</div>
      </main>
      <footer className="mx-auto flex max-w-[820px] flex-col gap-4 px-4 py-10 text-sm text-ink-3 md:flex-row md:items-center md:justify-between md:px-8">
        <a href="/" className="font-semibold tracking-[-0.02em] text-ink">
          Eagle Touch
        </a>
        <nav aria-label="Pages légales" className="flex flex-wrap gap-x-6 gap-y-2">
          {LEGAL_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>
        <p>© 2026 Eagle Touch</p>
      </footer>
    </>
  );
}
