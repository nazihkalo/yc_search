import { Suspense } from "react";

import { BatchPreview } from "../components/landing/batch-preview";
import { Features } from "../components/landing/features";
import { Hero } from "../components/landing/hero";
import { LandingFooter } from "../components/landing/footer";
import { MarketingNav } from "../components/landing/marketing-nav";
import { PricingTeaser } from "../components/landing/pricing-teaser";
import { StatsStrip } from "../components/landing/stats-strip";
import { VideoEmbed } from "../components/landing/video-embed";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <MarketingNav />
      <main>
        <Hero />
        <Suspense fallback={null}>
          <StatsStrip />
        </Suspense>
        <VideoEmbed />
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
