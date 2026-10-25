import { handlers, authReady } from "@/auth";
import type { NextRequest } from "next/server";
function allowed(request: NextRequest) {
  if (!authReady())
    return Response.json(
      { error: "Google sign-in is not configured." },
      { status: 503 },
    );
  const expected = new URL(process.env.AIDFLOW_PUBLIC_ORIGIN!);
  if (
    request.headers.get("host") !== expected.host ||
    (request.headers.has("origin") &&
      request.headers.get("origin") !== expected.origin)
  )
    return Response.json(
      { error: "Unexpected authentication origin." },
      { status: 403 },
    );
}
export async function GET(request: NextRequest) {
  return allowed(request) || handlers.GET(request);
}
export async function POST(request: NextRequest) {
  return allowed(request) || handlers.POST(request);
}
