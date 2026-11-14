import { DataSection } from "../components/landing/data-section";
import { LandingFooter } from "../components/landing/footer";
import { Hero } from "../components/landing/hero";
import { HowItWorks } from "../components/landing/how-it-works";
import { LatestBatch } from "../components/landing/latest-batch";
import { MarketingNav } from "../components/landing/marketing-nav";
import { getOverview } from "../lib/overview";

// Live counts and charts come from the database (cached in-process for a few
// minutes), so render on request rather than baking empty numbers at build time.
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const overview = await getOverview();
  const latestBatch = overview.recentBatchNames[0];
  const latestCount = overview.batches.find((b) => b.batch === latestBatch)?.count ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />
      <main>
        <Hero overview={overview} />
        <DataSection overview={overview} />
        <LatestBatch batch={latestBatch} total={latestCount} />
        <HowItWorks />
      </main>
      <LandingFooter />
    </div>
  );
}
