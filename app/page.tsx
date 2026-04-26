import { Suspense } from "react";

import { AppMockup } from "../components/landing/app-mockup";
import { BatchPreview } from "../components/landing/batch-preview";
import { Features } from "../components/landing/features";
import { Hero } from "../components/landing/hero";
import { LandingFooter } from "../components/landing/footer";
import { MarketingNav } from "../components/landing/marketing-nav";
import { PricingTeaser } from "../components/landing/pricing-teaser";
import { StatsStrip } from "../components/landing/stats-strip";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <MarketingNav />
      <main>
        <Hero />
        <AppMockup />
        <Suspense fallback={null}>
          <StatsStrip />
        </Suspense>
        <Features />
        <Suspense fallback={null}>
          <BatchPreview />
        </Suspense>
        <PricingTeaser />
      </main>
      <LandingFooter />
    </div>
  );
}
