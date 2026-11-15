import { AsyncLocalStorage } from "node:async_hooks";

export const vendorRunContext = new AsyncLocalStorage<{
  metrics: Record<string, number>;
  signal: AbortSignal;
  assertLease: () => void;
}>();

export function recordVendorMetric(name: string, value = 1) {
  const context = vendorRunContext.getStore();
  context?.assertLease();
  if (context) context.metrics[name] = (context.metrics[name] ?? 0) + value;
}
