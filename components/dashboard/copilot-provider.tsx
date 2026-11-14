"use client";

import { CopilotKit } from "@copilotkit/react-core";

// CopilotKit 1.56's provider defaults `headers`, `properties`, and its agent
// maps to a fresh `{}` on every render. Those objects are effect dependencies
// that re-run the runtime connection, and each reconnect re-renders the
// provider, so with the defaults it POSTs `{"method":"info"}` to
// /api/copilotkit in a tight loop and starves every other request on the page.
// Passing module-level constants keeps the references stable.
const STABLE_HEADERS: Record<string, string> = {};
const STABLE_PROPERTIES: Record<string, unknown> = {};
const STABLE_AGENTS = {};

const stableProviderProps = {
  headers: STABLE_HEADERS,
  properties: STABLE_PROPERTIES,
  agents__unsafe_dev_only: STABLE_AGENTS,
  selfManagedAgents: STABLE_AGENTS,
} as Record<string, unknown>;

export function CopilotProvider({
  children,
  enabled,
}: {
  children: React.ReactNode;
  enabled: boolean;
}) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <CopilotKit runtimeUrl="/api/copilotkit" showDevConsole={false} enableInspector={false} {...stableProviderProps}>
      {children}
    </CopilotKit>
  );
}
