"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";

function safeRedirectTarget(rawTarget: string | null) {
  if (typeof window === "undefined" || !rawTarget) {
    return "/dashboard";
  }

  try {
    const target = new URL(rawTarget, window.location.origin);

    if (target.origin !== window.location.origin) {
      return "/dashboard";
    }

    return `${target.pathname}${target.search}${target.hash}` || "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export function AuthRedirectGuard() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    router.replace(safeRedirectTarget(searchParams.get("redirect_url")));
  }, [isLoaded, isSignedIn, router, searchParams]);

  return null;
}
