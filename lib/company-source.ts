export function sourceLabel(sourceKind: string | null | undefined) {
  if (sourceKind === "yc") return "YC";
  if (sourceKind === "forbes_ai50") return "Forbes AI 50";
  return sourceKind?.replace(/_/g, " ") ?? "Unknown";
}

export function sourceBadgeTone(sourceKind: string | null | undefined) {
  if (sourceKind === "yc") return "source:yc";
  if (sourceKind === "forbes_ai50") return "source:forbes-ai50";
  return `source:${sourceKind ?? "unknown"}`;
}
