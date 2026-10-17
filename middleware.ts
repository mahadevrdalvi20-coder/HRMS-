import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Signed-out users can only see sign-in and the access-denied page.
// This only checks "signed in"; roles are checked on the server by lib/auth.
const isPublic = createRouteMatcher(["/sign-in(.*)", "/access-denied"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
