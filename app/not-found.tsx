export default function NotFound() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", fontFamily: "var(--font-geist-sans), sans-serif", background: "#f3f2ee", color: "#101814", padding: 24, textAlign: "center" }}>
      <div>
        <p style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em", margin: 0 }}>Page introuvable</p>
        <p style={{ marginTop: 8, color: "#4b5750" }}>
          <a href="/" style={{ color: "#17402f" }}>Retour à l&apos;accueil</a>
        </p>
      </div>
    </main>
  );
}
