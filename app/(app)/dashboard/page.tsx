import { Suspense } from "react";

import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { SearchDashboard } from "../../../components/search-dashboard";

export default function DashboardPage() {
  return (
    <DashboardShell>
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading dashboard...</div>}>
        <SearchDashboard />
      </Suspense>
    </DashboardShell>
  );
}
