"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

/** Filter setters exposed by SearchDashboard so the explore panel can drive it. */
export type WorkspaceFilterApi = {
  setQuery: (q: string) => void;
  setBatches: (v: string[]) => void;
  setIndustries: (v: string[]) => void;
  setTags: (v: string[]) => void;
  setIsHiring: (v: boolean) => void;
  clearFilters: () => void;
  showResults: () => void;
};

export type ExploreSelection =
  | { kind: "batch"; values: string[]; label: string }
  | { kind: "industry"; value: string }
  | { kind: "tag"; value: string }
  | { kind: "hiring" }
  | { kind: "all" };

type WorkspaceContextValue = {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  registerFilterApi: (api: WorkspaceFilterApi | null) => void;
  explore: (selection: ExploreSelection) => void;
  /** Label of the last thing picked in the explore panel, for highlighting. */
  activeSelection: string | null;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function selectionKey(selection: ExploreSelection): string {
  switch (selection.kind) {
    case "batch":
      return `batch:${selection.label}`;
    case "industry":
      return `industry:${selection.value}`;
    case "tag":
      return `tag:${selection.value}`;
    case "hiring":
      return "hiring";
    case "all":
      return "all";
  }
}

export function WorkspaceProvider({
  children,
  initialDrawerOpen = false,
}: {
  children: React.ReactNode;
  initialDrawerOpen?: boolean;
}) {
  const [drawerOpen, setDrawerOpen] = useState(initialDrawerOpen);
  const [activeSelection, setActiveSelection] = useState<string | null>(null);
  const apiRef = useRef<WorkspaceFilterApi | null>(null);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => setDrawerOpen((open) => !open), []);
  const registerFilterApi = useCallback((api: WorkspaceFilterApi | null) => {
    apiRef.current = api;
  }, []);

  const explore = useCallback((selection: ExploreSelection) => {
    const api = apiRef.current;
    if (!api) return;
    api.clearFilters();
    switch (selection.kind) {
      case "batch":
        api.setBatches(selection.values);
        break;
      case "industry":
        api.setIndustries([selection.value]);
        break;
      case "tag":
        api.setTags([selection.value]);
        break;
      case "hiring":
        api.setIsHiring(true);
        break;
      case "all":
        break;
    }
    api.showResults();
    setActiveSelection(selectionKey(selection));
    setDrawerOpen(true);
  }, []);

  const value = useMemo(
    () => ({
      drawerOpen,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      registerFilterApi,
      explore,
      activeSelection,
    }),
    [drawerOpen, openDrawer, closeDrawer, toggleDrawer, registerFilterApi, explore, activeSelection],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
