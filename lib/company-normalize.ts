import type { YcCompany } from "./types";

export function buildCompanySearchText(company: YcCompany): string {
  const fields = [
    company.name,
    company.one_liner ?? "",
    company.long_description ?? "",
    company.industry ?? "",
    company.subindustry ?? "",
    company.batch ?? "",
    company.stage ?? "",
    company.status ?? "",
    company.all_locations ?? "",
    company.tags.join(" "),
    company.industries.join(" "),
    company.regions.join(" "),
  ];

  return fields
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function launchedYear(launchedAt: number | null | undefined): number | null {
  if (!launchedAt) {
    return null;
  }

  return new Date(launchedAt * 1000).getUTCFullYear();
}
