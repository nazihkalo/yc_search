import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/clerk(.*)",
  "/api/sync(.*)",
  "/api/landing-chat(.*)",
  "/logos/(.*)",
  "/video/(.*)",
  "/favicon.ico",
]);

const isApiRoute = createRouteMatcher(["/api/(.*)"]);
const DEFAULT_PRODUCTION_ORIGIN = "https://ycsearch.com";

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function getConfiguredOrigin() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : null) ||
    (process.env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_ORIGIN : null);

  if (!configuredUrl) {
    return null;
  }

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return null;
  }
}

function isInternalHostname(hostname: string) {
  return (
    hostname === "0.0.0.0" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "localhost"
  );
}

function getPublicRequestUrl(req: Request) {
  const url = new URL(req.url);
  const host =
    firstForwardedValue(req.headers.get("x-forwarded-host")) ??
    firstForwardedValue(req.headers.get("host"));
  const proto =
    firstForwardedValue(req.headers.get("x-forwarded-proto")) ??
    url.protocol.replace(":", "");

  if (host) {
    url.host = host;
  }

  if (proto) {
    url.protocol = `${proto}:`;
  }

  const configuredOrigin = getConfiguredOrigin();

  if (configuredOrigin) {
    const configuredUrl = new URL(configuredOrigin);
    const hasConfiguredHostname = url.hostname === configuredUrl.hostname;
    const hasUnexpectedPort = url.port !== configuredUrl.port;

    if (
      isInternalHostname(url.hostname) ||
      (hasConfiguredHostname && hasUnexpectedPort)
    ) {
      url.protocol = configuredUrl.protocol;
      url.host = configuredUrl.host;
    }
  }

  return url.toString();
}

function getPublicOrigin(req: Request) {
  return new URL(getPublicRequestUrl(req)).origin;
}

function getReturnBackUrl(req: Request) {
  const url = new URL(req.url);
  const path = `${url.pathname}${url.search}${url.hash}`;
  const origin = getConfiguredOrigin() ?? getPublicOrigin(req);

  return new URL(path, origin).toString();
}

function redirectToAppSignIn(req: Request) {
  const signInUrl = new URL(
    "/sign-in",
    getConfiguredOrigin() ?? new URL(req.url).origin,
  );

  signInUrl.searchParams.set("redirect_url", getReturnBackUrl(req));

  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: signInUrl.toString(),
    },
  });
}

export default clerkMiddleware(
  async (auth, req) => {
    if (isPublicRoute(req)) {
      return NextResponse.next();
    }

    const { userId } = await auth();

    if (!userId) {
      if (isApiRoute(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return redirectToAppSignIn(req);
    }
  },
  (req) => {
    const origin = getPublicOrigin(req);

    return {
      signInUrl: `${origin}/sign-in`,
      signUpUrl: `${origin}/sign-up`,
    };
  },
);

export const config = {
  matcher: [
    // Skip public routes, Next internals, and static files.
    "/((?!$|_next|sign-in|sign-up|api/webhooks/clerk|api/sync|api/landing-chat|logos|video|favicon.ico|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|mp4|mov|webm|zip|webmanifest)).*)",
  ],
};
