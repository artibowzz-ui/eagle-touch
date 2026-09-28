export function Footer() {
  return (
    <footer className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-10 text-sm text-ink-3 md:flex-row md:items-center md:justify-between md:px-8">
      <p className="font-semibold tracking-[-0.02em] text-ink">Eagle Touch</p>
      <nav aria-label="Pied de page" className="flex flex-wrap gap-x-6 gap-y-2">
        <a href="#fonctionnement" className="hover:text-ink">Fonctionnement</a>
        <a href="#moyenne" className="hover:text-ink">Classement</a>
        <a href="#defis" className="hover:text-ink">Défis</a>
      </nav>
      <p>© 2026 Eagle Touch</p>
    </footer>
  );
}
