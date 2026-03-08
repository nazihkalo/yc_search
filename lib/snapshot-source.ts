export const WEBSITE_SNAPSHOT_SOURCE = "crawl4ai";
export const YC_PROFILE_SNAPSHOT_SOURCE = "yc_profile";

export const SNAPSHOT_SOURCES = [WEBSITE_SNAPSHOT_SOURCE, YC_PROFILE_SNAPSHOT_SOURCE] as const;

export type SnapshotSource = (typeof SNAPSHOT_SOURCES)[number];

export const ACTIVE_SNAPSHOT_SOURCE: SnapshotSource = WEBSITE_SNAPSHOT_SOURCE;
