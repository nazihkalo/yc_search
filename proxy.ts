import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/clerk(.*)",
  "/api/sync(.*)",
  "/logos/(.*)",
  "/video/(.*)",
  "/favicon.ico",
]);

const isApiRoute = createRouteMatcher(["/api/(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) {
    return;
  }

  const { userId, redirectToSignIn } = await auth();

  if (!userId) {
    if (isApiRoute(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return redirectToSignIn({ returnBackUrl: req.url });
  }
});

export const config = {
  matcher: [
    // Skip Next internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|mp4|mov|webm|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
