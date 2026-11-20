import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const VERIFY_HEADER = "x-origin-verify";

export function proxy(request: NextRequest) {
  const secret = process.env.ORIGIN_VERIFY_SECRET;
  if (!secret) return NextResponse.next();
  if (request.nextUrl.pathname === "/health") return NextResponse.next();
  if (request.headers.get(VERIFY_HEADER) === secret) return NextResponse.next();

  return new NextResponse("Forbidden", {
    status: 403,
    headers: { "cache-control": "no-store" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico)$).*)"],
};
