/* Numéro de la version en ligne. L'application le compare au sien pour se mettre à jour toute seule. */
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(process.env.NEXT_PUBLIC_BUILD_ID || "", {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store, max-age=0" },
  });
}
