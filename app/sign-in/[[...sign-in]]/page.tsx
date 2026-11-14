import { SignIn } from "@clerk/nextjs";

import { AuthLayout, authAppearance } from "../../../components/auth/auth-layout";
import { AuthRedirectGuard } from "../../../components/auth/auth-redirect-guard";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to pick up your research where you left off.">
      <AuthRedirectGuard />
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
        appearance={authAppearance}
      />
    </AuthLayout>
  );
}
