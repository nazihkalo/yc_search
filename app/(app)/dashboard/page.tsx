import { Suspense } from "react";

import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { SearchDashboard } from "../../../components/search-dashboard";

export default function DashboardPage() {
  const copilotEnabled = Boolean(process.env.OPENAI_API_KEY?.trim());

  return (
    <DashboardShell copilotEnabled={copilotEnabled}>
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading dashboard...</div>}>
        <SearchDashboard copilotEnabled={copilotEnabled} />
      </Suspense>
    </DashboardShell>
  );
}
