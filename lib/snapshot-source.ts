export const SNAPSHOT_SOURCES = ["crawl4ai"] as const;

export type SnapshotSource = (typeof SNAPSHOT_SOURCES)[number];

export const ACTIVE_SNAPSHOT_SOURCE: SnapshotSource = "crawl4ai";
