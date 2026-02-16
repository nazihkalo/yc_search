import { Suspense } from "react";

import { SearchDashboard } from "../components/search-dashboard";

export default function Home() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">Loading dashboard...</div>}>
      <SearchDashboard />
    </Suspense>
  );
}
