import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";

import { AuthLayout, authAppearance } from "../../../components/auth/auth-layout";
import { AuthRedirectGuard } from "../../../components/auth/auth-redirect-guard";
import { StorePendingQuestion } from "../../../components/auth/store-pending-question";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return (
    <AuthLayout title="Start exploring" subtitle="Free while in beta. No credit card.">
      <AuthRedirectGuard />
      <Suspense fallback={null}>
        <StorePendingQuestion />
      </Suspense>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
        appearance={authAppearance}
      />
    </AuthLayout>
  );
}
