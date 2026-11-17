import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { missingEnv } from "@/lib/config";

// Signed-out users can only see sign-in and the access-denied page.
// This only checks "signed in"; roles are checked on the server by lib/auth.
const isPublic = createRouteMatcher(["/sign-in(.*)", "/access-denied"]);

const withClerk = clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

// Until the keys are set, let requests through so the layout can show the
// "setup needed" page. No data is reachable then: every page and API route
// still calls lib/auth, which needs Clerk and Supabase.
export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (missingEnv().length > 0) return NextResponse.next();
  return withClerk(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
