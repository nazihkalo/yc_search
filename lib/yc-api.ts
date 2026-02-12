import { z } from "zod";

import type { YcCompany } from "./types";

const YC_ALL_COMPANIES_URL = "https://yc-oss.github.io/api/companies/all.json";
const nullableBoolean = z.boolean().nullable().optional().transform((value) => Boolean(value));

const ycCompanySchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  former_names: z.array(z.string()).default([]),
  small_logo_thumb_url: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  all_locations: z.string().nullable().optional(),
  long_description: z.string().nullable().optional(),
  one_liner: z.string().nullable().optional(),
  team_size: z.number().nullable().optional(),
  highlight_black: nullableBoolean,
  highlight_latinx: nullableBoolean,
  highlight_women: nullableBoolean,
  industry: z.string().nullable().optional(),
  subindustry: z.string().nullable().optional(),
  launched_at: z.number().nullable().optional(),
  tags: z.array(z.string()).default([]),
  top_company: nullableBoolean,
  isHiring: nullableBoolean,
  nonprofit: nullableBoolean,
  batch: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  industries: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
  stage: z.string().nullable().optional(),
  app_video_public: nullableBoolean,
  demo_day_video_public: nullableBoolean,
  question_answers: nullableBoolean,
  url: z.string().nullable().optional(),
  api: z.string().nullable().optional(),
});

const companiesSchema = z.array(ycCompanySchema);

export async function fetchYcCompanies(): Promise<YcCompany[]> {
  const response = await fetch(YC_ALL_COMPANIES_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch YC data (${response.status})`);
  }

  const data = companiesSchema.parse(await response.json());
  return data.map((company) => ({
    ...company,
    small_logo_thumb_url: company.small_logo_thumb_url ?? null,
    website: company.website ?? null,
    all_locations: company.all_locations ?? null,
    long_description: company.long_description ?? null,
    one_liner: company.one_liner ?? null,
    team_size: company.team_size ?? null,
    industry: company.industry ?? null,
    subindustry: company.subindustry ?? null,
    launched_at: company.launched_at ?? null,
    batch: company.batch ?? null,
    status: company.status ?? null,
    stage: company.stage ?? null,
    url: company.url ?? null,
    api: company.api ?? null,
  }));
}
