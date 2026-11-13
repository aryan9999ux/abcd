export const dynamic = "force-dynamic";

/** For the hosting platform's health check. */
export function GET() {
  return Response.json({ ok: true });
}
