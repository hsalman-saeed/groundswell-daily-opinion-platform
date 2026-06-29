import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Lightweight Edge-compatible middleware.
 * 
 * Checks for the NextAuth session token cookie on protected routes.
 * The actual auth validation happens in the API route handlers via auth().
 * This middleware just provides a fast 401 for completely unauthenticated requests.
 */
export function middleware(request: NextRequest) {
  // Check for NextAuth session cookie (works in both dev and prod)
  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value ||
    request.cookies.get("next-auth.session-token")?.value ||
    request.cookies.get("__Secure-next-auth.session-token")?.value

  if (!sessionToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/votes/submit", "/api/predictions/submit"],
}
