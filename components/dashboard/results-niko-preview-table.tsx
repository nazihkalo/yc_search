"use client";

import { memo, useMemo, useState } from "react";
import type {
  ColumnFiltersState,
  PaginationState,
  SortingState,
  Updater,
  VisibilityState,
} from "@tanstack/react-table";
import { Check, ChevronRight, Filter, Loader2, SearchX, UserSearch } from "lucide-react";
import { useRouter } from "next/navigation";

import { DataTableColumnFacetedFilterMenu } from "@/components/niko-table/components/data-table-column-faceted-filter";
import { DataTableColumnHeader } from "@/components/niko-table/components/data-table-column-header";
import { DataTableColumnSortMenu } from "@/components/niko-table/components/data-table-column-sort";
import { DataTableColumnTitle } from "@/components/niko-table/components/data-table-column-title";
import {
  DataTableEmptyDescription,
  DataTableEmptyFilteredMessage,
  DataTableEmptyIcon,
  DataTableEmptyMessage,
  DataTableEmptyTitle,
} from "@/components/niko-table/components/data-table-empty-state";
import { DataTablePagination } from "@/components/niko-table/components/data-table-pagination";
import { DataTableToolbarSection } from "@/components/niko-table/components/data-table-toolbar-section";
import { DataTableViewMenu } from "@/components/niko-table/components/data-table-view-menu";
import { DataTable } from "@/components/niko-table/core/data-table";
import { DataTableRoot } from "@/components/niko-table/core/data-table-root";
import {
  DataTableBody,
  DataTableEmptyBody,
  DataTableHeader,
  DataTableSkeleton,
} from "@/components/niko-table/core/data-table-structure";
import { FILTER_VARIANTS } from "@/components/niko-table/lib/constants";
import type { DataTableColumnDef } from "@/components/niko-table/types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { CompanyLinksRow } from "./company-links-row";
import type { CompanyResult, FacetItem, TableColumnKey } from "./types";

type SortOption = "relevance" | "newest" | "team_size" | "name";

const OPTIONAL_COLUMNS: TableColumnKey[] = [
  "score",
  "industries",
  "tags",
  "batch",
  "stage",
  "team_size",
  "status",
  "links",
  "location",
  "launched_year",
];

const STATUS_OPTIONS = [
  { label: "Hiring", value: "hiring" },
  { label: "Top Company", value: "top" },
  { label: "Nonprofit", value: "nonprofit" },
];
const FALLBACK_LOGO_SRC = "/placeholders/company-logo.svg";
const failedLogoUrls = new Set<string>();

export function ResultsNikoPreviewTable({
  results,
  total,
  page,
  pageSize,
  pageSizeOptions,
  returnToPath,
  sort,
  visibleColumns,
  selectedYears,
  selectedTags,
  selectedIndustries,
  selectedBatches,
  selectedStages,
  selectedRegions,
  isHiring,
  topCompany,
  nonprofit,
  tagOptions,
  industryOptions,
  batchOptions,
  stageOptions,
  regionOptions,
  isLoading,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onVisibleColumnsChange,
  onYearsChange,
  onTagsChange,
  onIndustriesChange,
  onBatchesChange,
  onStagesChange,
  onRegionsChange,
  onStatusFlagsChange,
  toolbarPrefix,
}: {
  results: CompanyResult[];
  total: number;
  page: number;
  pageSize: number;
  pageSizeOptions: number[];
  returnToPath: string;
  sort: SortOption;
  visibleColumns: TableColumnKey[];
  selectedYears: number[];
  selectedTags: string[];
  selectedIndustries: string[];
  selectedBatches: string[];
  selectedStages: string[];
  selectedRegions: string[];
  isHiring: boolean;
  topCompany: boolean;
  nonprofit: boolean;
  tagOptions: FacetItem<string>[];
  industryOptions: FacetItem<string>[];
  batchOptions: FacetItem<string>[];
  stageOptions: FacetItem<string>[];
  regionOptions: FacetItem<string>[];
  isLoading: boolean;
  onSortChange: (sort: SortOption) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onVisibleColumnsChange: (columns: TableColumnKey[]) => void;
  onYearsChange: (values: number[]) => void;
  onTagsChange: (values: string[]) => void;
  onIndustriesChange: (values: string[]) => void;
  onBatchesChange: (values: string[]) => void;
  onStagesChange: (values: string[]) => void;
  onRegionsChange: (values: string[]) => void;
  onStatusFlagsChange: (next: {
    isHiring: boolean;
    topCompany: boolean;
    nonprofit: boolean;
  }) => void;
  toolbarPrefix?: React.ReactNode;
}) {
  const router = useRouter();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const initialLoading = isLoading && results.length === 0;
  const [batchFilterOpen, setBatchFilterOpen] = useState(false);
  const [batchFilterFocusedYear, setBatchFilterFocusedYear] = useState<
    number | null
  >(selectedYears[0] ?? yearOptionsFromBatches(batchOptions)[0]?.value ?? null);

  const pagination = useMemo<PaginationState>(
    () => ({
      pageIndex: Math.max(0, page - 1),
      pageSize,
    }),
    [page, pageSize],
  );

  const sorting = useMemo<SortingState>(() => {
    switch (sort) {
      case "name":
        return [{ id: "name", desc: false }];
      case "team_size":
        return [{ id: "team_size", desc: true }];
      case "newest":
        return [{ id: "launched_year", desc: true }];
      case "relevance":
      default:
        return [{ id: "score", desc: true }];
    }
  }, [sort]);

  const columnFilters = useMemo<ColumnFiltersState>(() => {
    const statusValues = [
      isHiring ? "hiring" : null,
      topCompany ? "top" : null,
      nonprofit ? "nonprofit" : null,
    ].filter((value): value is string => Boolean(value));

    return [
      ...(selectedTags.length > 0 ? [{ id: "tags", value: selectedTags }] : []),
      ...(selectedIndustries.length > 0
        ? [{ id: "industries", value: selectedIndustries }]
        : []),
      ...(selectedBatches.length > 0
        ? [{ id: "batch", value: selectedBatches }]
        : []),
      ...(selectedStages.length > 0
        ? [{ id: "stage", value: selectedStages }]
        : []),
      ...(selectedRegions.length > 0
        ? [{ id: "location", value: selectedRegions }]
        : []),
      ...(statusValues.length > 0 ? [{ id: "status", value: statusValues }] : []),
    ];
  }, [
    isHiring,
    nonprofit,
    selectedBatches,
    selectedIndustries,
    selectedRegions,
    selectedStages,
    selectedTags,
    topCompany,
  ]);

  const columnVisibility = useMemo<VisibilityState>(() => {
    return OPTIONAL_COLUMNS.reduce<VisibilityState>((state, columnKey) => {
      state[columnKey] = visibleColumns.includes(columnKey);
      return state;
    }, {});
  }, [visibleColumns]);

  const columns = useMemo<DataTableColumnDef<CompanyResult>[]>(
    () => [
      {
        accessorKey: "name",
        enableHiding: false,
        size: 280,
        meta: {
          label: "Company",
          variant: FILTER_VARIANTS.TEXT,
        },
        header: () => (
          <DataTableColumnHeader>
            <DataTableColumnTitle />
            <DataTableColumnSortMenu />
          </DataTableColumnHeader>
        ),
        cell: ({ row }) => {
          const company = row.original;

          return (
            <div className="min-w-[260px] py-1">
              <div className="flex items-start gap-3">
                <CompanyLogo
                  key={company.small_logo_thumb_url ?? `fallback-${company.id}`}
                  src={company.small_logo_thumb_url}
                  companyName={company.name}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{company.name}</p>
                    {typeof company.score === "number" &&
                    !visibleColumns.includes("score") ? (
                      <Badge variant="secondary">
                        {company.score.toFixed(3)}
                      </Badge>
                    ) : null}
                    {company.top_company ? <Badge>Top</Badge> : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {company.one_liner ?? "No one-liner available."}
                  </p>
                  {company.all_locations ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {company.all_locations}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {company.is_hiring ? <Badge variant="success">Hiring</Badge> : null}
                    {company.nonprofit ? (
                      <Badge variant="secondary">Nonprofit</Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "score",
        size: 72,
        meta: {
          label: "Score",
          variant: FILTER_VARIANTS.NUMBER,
        },
        header: () => (
          <DataTableColumnHeader>
            <DataTableColumnTitle />
            <DataTableColumnSortMenu />
          </DataTableColumnHeader>
        ),
        cell: ({ row }) => {
          const score = row.original.score;
          return (
            <div className="text-sm text-muted-foreground">
              {typeof score === "number" ? score.toFixed(3) : "N/A"}
            </div>
          );
        },
      },
      {
        accessorKey: "industries",
        size: 132,
        meta: {
          label: "Industries",
          variant: FILTER_VARIANTS.MULTI_SELECT,
          options: industryOptions.map((item) => ({
            label: item.value,
            value: item.value,
            count: item.count,
          })),
          autoOptions: false,
        },
        header: () => (
          <DataTableColumnHeader>
            <DataTableColumnTitle />
            <DataTableColumnFacetedFilterMenu
              options={industryOptions.map((item) => ({
                label: item.value,
                value: item.value,
                count: item.count,
              }))}
            />
          </DataTableColumnHeader>
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[120px] flex-wrap gap-1.5">
            {row.original.industries.length > 0 ? (
              row.original.industries.slice(0, 1).map((industry) => (
                <Badge
                  key={`${row.original.id}-industry-${industry}`}
                  variant="muted"
                  className="max-w-[104px] truncate"
                >
                  {industry}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">N/A</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "tags",
        size: 148,
        meta: {
          label: "Tags",
          variant: FILTER_VARIANTS.MULTI_SELECT,
          options: tagOptions.map((item) => ({
            label: item.value,
            value: item.value,
            count: item.count,
          })),
          autoOptions: false,
        },
        header: () => (
          <DataTableColumnHeader>
            <DataTableColumnTitle />
            <DataTableColumnFacetedFilterMenu
              options={tagOptions.map((item) => ({
                label: item.value,
                value: item.value,
                count: item.count,
              }))}
            />
          </DataTableColumnHeader>
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[130px] flex-wrap gap-1.5">
            {row.original.tags.length > 0 ? (
              <>
                {row.original.tags.slice(0, 2).map((tag) => (
                <span
                  key={`${row.original.id}-tag-${tag}`}
                  className="max-w-[100px] truncate rounded-full border border-border/70 bg-background/70 px-2 py-1 text-[11px] text-muted-foreground"
                >
                  {tag}
                </span>
                ))}
                {row.original.tags.length > 2 ? (
                  <span className="rounded-full border border-border/70 bg-background/70 px-2 py-1 text-[11px] text-muted-foreground">
                    +{row.original.tags.length - 2}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">N/A</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "batch",
        size: 86,
        meta: {
          label: "Batch",
          variant: FILTER_VARIANTS.SELECT,
          options: batchOptions.map((item) => ({
            label: item.value,
            value: item.value,
            count: item.count,
          })),
          autoOptions: false,
        },
        header: () => (
          <DataTableColumnHeader>
            <DataTableColumnTitle />
            <BatchHierarchyFilterMenu
              yearOptions={yearOptionsFromBatches(batchOptions)}
              batchOptions={batchOptions}
              selectedYears={selectedYears}
              selectedBatches={selectedBatches}
              onYearsChange={onYearsChange}
              onBatchesChange={onBatchesChange}
              open={batchFilterOpen}
              onOpenChange={setBatchFilterOpen}
              focusedYear={batchFilterFocusedYear}
              onFocusedYearChange={setBatchFilterFocusedYear}
            />
            <DataTableColumnSortMenu />
          </DataTableColumnHeader>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.batch ?? "N/A"}
          </span>
        ),
      },
      {
        accessorKey: "stage",
        size: 96,
        meta: {
          label: "Stage",
          variant: FILTER_VARIANTS.SELECT,
          options: stageOptions.map((item) => ({
            label: item.value,
            value: item.value,
            count: item.count,
          })),
          autoOptions: false,
        },
        header: () => (
          <DataTableColumnHeader>
            <DataTableColumnTitle />
            <DataTableColumnFacetedFilterMenu
              options={stageOptions.map((item) => ({
                label: item.value,
                value: item.value,
                count: item.count,
              }))}
            />
          </DataTableColumnHeader>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.stage ?? "N/A"}
          </span>
        ),
      },
      {
        accessorKey: "team_size",
        size: 84,
        meta: {
          label: "Team",
          variant: FILTER_VARIANTS.NUMBER,
        },
        header: () => (
          <DataTableColumnHeader>
            <DataTableColumnTitle />
            <DataTableColumnSortMenu />
          </DataTableColumnHeader>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.team_size
              ? row.original.team_size.toLocaleString()
              : "N/A"}
          </span>
        ),
      },
      {
        id: "location",
        accessorFn: (row) => row.regions,
        size: 156,
        meta: {
          label: "Location",
          variant: FILTER_VARIANTS.MULTI_SELECT,
          options: regionOptions.map((item) => ({
            label: item.value,
            value: item.value,
            count: item.count,
          })),
          autoOptions: false,
        },
        header: () => (
          <DataTableColumnHeader>
            <DataTableColumnTitle title="Location" />
            <DataTableColumnFacetedFilterMenu
              options={regionOptions.map((item) => ({
                label: item.value,
                value: item.value,
                count: item.count,
              }))}
            />
          </DataTableColumnHeader>
        ),
        cell: ({ row }) => (
          <span className="line-clamp-2 min-w-[140px] text-sm text-muted-foreground">
            {row.original.all_locations ?? "N/A"}
          </span>
        ),
      },
      {
        accessorKey: "launched_year",
        size: 88,
        meta: {
          label: "Launched",
          variant: FILTER_VARIANTS.NUMBER,
        },
        header: () => (
          <DataTableColumnHeader>
            <DataTableColumnTitle />
            <DataTableColumnSortMenu />
          </DataTableColumnHeader>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.launched_year
              ? String(row.original.launched_year)
              : "N/A"}
          </span>
        ),
      },
      {
        id: "status",
        size: 144,
        accessorFn: (row) =>
          [
            row.status,
            row.is_hiring ? "hiring" : null,
            row.top_company ? "top" : null,
            row.nonprofit ? "nonprofit" : null,
          ].filter((value): value is string => Boolean(value)),
        meta: {
          label: "Status",
          variant: FILTER_VARIANTS.MULTI_SELECT,
          options: STATUS_OPTIONS,
          autoOptions: false,
        },
        header: () => (
          <DataTableColumnHeader>
            <DataTableColumnTitle />
            <DataTableColumnFacetedFilterMenu options={STATUS_OPTIONS} />
          </DataTableColumnHeader>
        ),
        cell: ({ row }) => {
          const company = row.original;

          return (
            <div className="flex min-w-[132px] flex-wrap gap-1.5">
              {company.status ? (
                <Badge variant="secondary">{company.status}</Badge>
              ) : null}
              {company.is_hiring ? <Badge variant="success">Hiring</Badge> : null}
              {company.top_company ? <Badge>Top</Badge> : null}
              {company.nonprofit ? (
                <Badge variant="secondary">Nonprofit</Badge>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "links",
        size: 112,
        accessorFn: (row) => row.top_links,
        meta: {
          label: "Links",
          variant: FILTER_VARIANTS.TEXT,
        },
        header: () => (
          <DataTableColumnHeader>
            <DataTableColumnTitle title="Links" />
          </DataTableColumnHeader>
        ),
        cell: ({ row }) => (
          <div className="min-w-[100px]">
            <CompanyLinksRow links={row.original.top_links.slice(0, 3)} compact />
          </div>
        ),
      },
    ],
    [
      batchOptions,
      industryOptions,
      onBatchesChange,
      batchFilterFocusedYear,
      batchFilterOpen,
      onYearsChange,
      regionOptions,
      selectedBatches,
      selectedYears,
      stageOptions,
      tagOptions,
      visibleColumns,
    ],
  );

  function handleSortingChange(updater: Updater<SortingState>) {
    const nextSorting =
      typeof updater === "function" ? updater(sorting) : updater;
    const nextColumn = nextSorting[0]?.id;

    switch (nextColumn) {
      case "name":
        onSortChange("name");
        break;
      case "team_size":
        onSortChange("team_size");
        break;
      case "batch":
      case "launched_year":
        onSortChange("newest");
        break;
      case "score":
      default:
        onSortChange("relevance");
        break;
    }
  }

  function handlePaginationChange(updater: Updater<PaginationState>) {
    const nextPagination =
      typeof updater === "function" ? updater(pagination) : updater;

    if (nextPagination.pageSize !== pagination.pageSize) {
      onPageSizeChange(nextPagination.pageSize);
    }

    if (nextPagination.pageIndex !== pagination.pageIndex) {
      onPageChange(nextPagination.pageIndex + 1);
    }
  }

  function handleColumnVisibilityChange(updater: Updater<VisibilityState>) {
    const nextVisibility =
      typeof updater === "function" ? updater(columnVisibility) : updater;

    onVisibleColumnsChange(
      OPTIONAL_COLUMNS.filter((columnKey) => nextVisibility[columnKey] !== false),
    );
  }

  function handleColumnFiltersChange(updater: Updater<ColumnFiltersState>) {
    const nextFilters =
      typeof updater === "function" ? updater(columnFilters) : updater;

    const nextIndustries = getFilterValues(nextFilters, "industries");
    const nextBatches = getFilterValues(nextFilters, "batch");
    const nextStages = getFilterValues(nextFilters, "stage");
    const nextTags = getFilterValues(nextFilters, "tags");
    const nextRegions = getFilterValues(nextFilters, "location");
    const nextStatuses = new Set(getFilterValues(nextFilters, "status"));

    onTagsChange(nextTags);
    onIndustriesChange(nextIndustries);
    onBatchesChange(nextBatches);
    onStagesChange(nextStages);
    onRegionsChange(nextRegions);
    onStatusFlagsChange({
      isHiring: nextStatuses.has("hiring"),
      topCompany: nextStatuses.has("top"),
      nonprofit: nextStatuses.has("nonprofit"),
    });
  }

  return (
    <Card className="overflow-hidden border-border/60 bg-card/95 shadow-sm">
      <CardContent className="p-0">
        <DataTableRoot
          data={results}
          columns={columns}
          isLoading={initialLoading}
          config={{
            manualPagination: true,
            manualFiltering: true,
            manualSorting: true,
            pageCount,
          }}
          state={{
            pagination,
            sorting,
            columnFilters,
            columnVisibility,
          }}
          onSortingChange={handleSortingChange}
          onPaginationChange={handlePaginationChange}
          onColumnFiltersChange={handleColumnFiltersChange}
          onColumnVisibilityChange={handleColumnVisibilityChange}
        >
          <div className="border-b border-border/60 px-4 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              {toolbarPrefix ? (
                <div className="flex flex-wrap items-end gap-3">{toolbarPrefix}</div>
              ) : (
                <div />
              )}
              <DataTableToolbarSection className="justify-end px-0">
                {isLoading && !initialLoading ? (
                  <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Refreshing
                  </div>
                ) : null}
                <div className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
                  {total.toLocaleString()} matches
                </div>
                <DataTableViewMenu />
              </DataTableToolbarSection>
            </div>
          </div>

          <DataTable className="min-w-[980px]">
            <DataTableHeader />
            <DataTableBody
              onRowClick={(company: CompanyResult) => {
                router.push(
                  `/companies/${company.id}?returnTo=${encodeURIComponent(
                    returnToPath,
                  )}`,
                );
              }}
            >
              <DataTableSkeleton rows={pageSize} />
              <DataTableEmptyBody>
                <DataTableEmptyMessage>
                  <DataTableEmptyIcon>
                    <UserSearch className="size-12" />
                  </DataTableEmptyIcon>
                  <DataTableEmptyTitle>No companies found</DataTableEmptyTitle>
                  <DataTableEmptyDescription>
                    There are no companies to display right now.
                  </DataTableEmptyDescription>
                </DataTableEmptyMessage>
                <DataTableEmptyFilteredMessage>
                  <DataTableEmptyIcon>
                    <SearchX className="size-12" />
                  </DataTableEmptyIcon>
                  <DataTableEmptyTitle>No matches found</DataTableEmptyTitle>
                  <DataTableEmptyDescription>
                    Clear or adjust the active column filters to broaden the result
                    set.
                  </DataTableEmptyDescription>
                </DataTableEmptyFilteredMessage>
              </DataTableEmptyBody>
            </DataTableBody>
          </DataTable>

          <div className="border-t border-border/60 px-4 py-3">
            <DataTablePagination
              totalCount={total}
              pageSizeOptions={pageSizeOptions}
              isLoading={initialLoading}
              isFetching={isLoading && !initialLoading}
            />
          </div>
        </DataTableRoot>
      </CardContent>
    </Card>
  );
}

function getFilterValues(filters: ColumnFiltersState, id: string): string[] {
  const filter = filters.find((item) => item.id === id);
  const value = filter?.value;

  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "value" in value
  ) {
    const nestedValue = (value as { value: unknown }).value;
    if (Array.isArray(nestedValue)) {
      return nestedValue.map((item) => String(item)).filter(Boolean);
    }
    if (typeof nestedValue === "string" && nestedValue) {
      return [nestedValue];
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string" && value) {
    return [value];
  }

  return [];
}

function parseBatchYear(batch: string) {
  const compactBatchMatch = batch.match(/^([WSF])(\d{2})$/i);
  if (compactBatchMatch) {
    return 2000 + Number(compactBatchMatch[2]);
  }

  const namedBatchMatch = batch.match(/^(Winter|Spring|Summer|Fall)\s+(\d{4})$/i);
  if (namedBatchMatch) {
    return Number(namedBatchMatch[2]);
  }

  return null;
}

function yearOptionsFromBatches(batchOptions: FacetItem<string>[]) {
  const counts = new Map<number, number>();

  for (const option of batchOptions) {
    const year = parseBatchYear(option.value);
    if (year) {
      counts.set(year, (counts.get(year) ?? 0) + option.count);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[0] - left[0])
    .map(([value, count]) => ({ value, count }));
}

const BatchHierarchyFilterMenu = memo(function BatchHierarchyFilterMenu({
  yearOptions,
  batchOptions,
  selectedYears,
  selectedBatches,
  onYearsChange,
  onBatchesChange,
  open,
  onOpenChange,
  focusedYear,
  onFocusedYearChange,
}: {
  yearOptions: FacetItem<number>[];
  batchOptions: FacetItem<string>[];
  selectedYears: number[];
  selectedBatches: string[];
  onYearsChange: (values: number[]) => void;
  onBatchesChange: (values: string[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusedYear: number | null;
  onFocusedYearChange: (year: number | null) => void;
}) {
  const groupedBatches = useMemo(() => {
    const groups = new Map<number, FacetItem<string>[]>();

    for (const option of batchOptions) {
      const year = parseBatchYear(option.value);
      if (!year) continue;
      groups.set(year, [...(groups.get(year) ?? []), option]);
    }

    return yearOptions.map((yearOption) => ({
      year: yearOption.value,
      count: yearOption.count,
      batches: (groups.get(yearOption.value) ?? []).sort((left, right) =>
        left.value.localeCompare(right.value),
      ),
    }));
  }, [batchOptions, yearOptions]);

  const activeYear =
    focusedYear && groupedBatches.some((group) => group.year === focusedYear)
      ? focusedYear
      : selectedYears[0] ?? groupedBatches[0]?.year ?? null;

  const activeGroup = groupedBatches.find((group) => group.year === activeYear) ?? null;
  const isActive = selectedYears.length > 0 || selectedBatches.length > 0;

  function toggleYear(year: number) {
    const yearIsSelected = selectedYears.includes(year);
    const nextYears = yearIsSelected
      ? selectedYears.filter((value) => value !== year)
      : [...selectedYears, year].sort((left, right) => right - left);

    onYearsChange(nextYears);

    if (yearIsSelected) {
      const allowedBatches = new Set(
        batchOptions
          .filter((option) => {
            const batchYear = parseBatchYear(option.value);
            return batchYear !== year;
          })
          .map((option) => option.value),
      );
      onBatchesChange(
        selectedBatches.filter((batch) => allowedBatches.has(batch)),
      );
    } else {
      onFocusedYearChange(year);
    }
  }

  function toggleBatch(batch: string, year: number | null) {
    const batchIsSelected = selectedBatches.includes(batch);
    const nextBatches = batchIsSelected
      ? selectedBatches.filter((value) => value !== batch)
      : [...selectedBatches, batch];

    onBatchesChange(nextBatches);

    if (!batchIsSelected && year && !selectedYears.includes(year)) {
      onYearsChange([...selectedYears, year].sort((left, right) => right - left));
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
        >
          <Filter
            className={isActive ? "size-3.5 text-primary" : "size-3.5 text-muted-foreground"}
          />
          <span className="sr-only">Filter batch or year</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[420px] p-0">
        <div className="grid grid-cols-[148px_minmax(0,1fr)]">
          <div className="border-r border-border/60 p-2">
            <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Year
            </p>
            <div className="mt-1 space-y-1">
              {yearOptions.map((option) => {
                const selected = selectedYears.includes(option.value);
                const focused = activeYear === option.value;

                return (
                  <button
                    key={`batch-year-${option.value}`}
                    type="button"
                    onClick={() => {
                      onFocusedYearChange(option.value);
                      toggleYear(option.value);
                    }}
                    onMouseEnter={() => onFocusedYearChange(option.value)}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs transition ${
                      selected
                        ? "bg-primary/10 text-primary"
                        : focused
                          ? "bg-muted/60 text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {selected ? <Check className="size-3.5" /> : <ChevronRight className="size-3.5 opacity-50" />}
                      {option.value}
                    </span>
                    <span className="text-[11px] opacity-70">{option.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-2">
            <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Batch
            </p>
            {activeGroup && activeGroup.batches.length > 0 ? (
              <div className="mt-1 max-h-72 space-y-1 overflow-auto">
                {activeGroup.batches.map((option) => {
                  const selected = selectedBatches.includes(option.value);
                  return (
                    <button
                      key={`batch-option-${option.value}`}
                      type="button"
                      onClick={() => toggleBatch(option.value, activeGroup.year)}
                      className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs transition ${
                        selected
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {selected ? <Check className="size-3.5" /> : null}
                        {option.value}
                      </span>
                      <span className="text-[11px] opacity-70">{option.count}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-2 py-4 text-xs text-muted-foreground">
                Select a year to narrow to a batch.
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

const CompanyLogo = memo(function CompanyLogo({
  src,
  companyName,
}: {
  src: string | null;
  companyName: string;
}) {
  const [hasFailed, setHasFailed] = useState(() =>
    src ? failedLogoUrls.has(src) : true,
  );

  if (!src || hasFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={FALLBACK_LOGO_SRC}
        alt={`${companyName} placeholder logo`}
        className="mt-0.5 size-11 rounded-xl border border-border/70 bg-muted/40 object-cover"
        loading="lazy"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${companyName} logo`}
      className="mt-0.5 size-11 rounded-xl border border-border/70 object-cover"
      loading="lazy"
      onError={() => {
        failedLogoUrls.add(src);
        setHasFailed(true);
      }}
    />
  );
});
