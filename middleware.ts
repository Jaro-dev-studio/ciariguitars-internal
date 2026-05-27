import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function checkPageAccess(pathname: string, pageAccess: string[]): boolean {
  if (!pageAccess || pageAccess.length === 0) return false;
  return pageAccess.some((path) => pathname.startsWith(path));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request });

  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const pageAccess = (token.pageAccess as string[]) || [];

  if (pathname !== "/dashboard") {
    if (!checkPageAccess(pathname, pageAccess)) {
      const firstAllowed = pageAccess[0] || "/dashboard";
      return NextResponse.redirect(new URL(firstAllowed, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
