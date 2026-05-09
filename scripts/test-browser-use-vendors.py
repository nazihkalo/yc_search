import argparse
import asyncio
import json
import os
import time
from pathlib import Path
from urllib.parse import urlparse

from browser_use import Agent, BrowserProfile, ChatOpenAI
from pydantic import BaseModel, Field


class VendorFinding(BaseModel):
    name: str = Field(description="Vendor or subprocessor name")
    relationship_type: str = Field(description="subprocessor, disclosed_vendor, detected_technology, or unknown")
    category: str | None = Field(default=None, description="Rough category if known")
    evidence_url: str = Field(description="URL where this vendor was found")
    evidence_text: str | None = Field(default=None, description="Short text snippet supporting the finding")


class BrowserUseVendorResult(BaseModel):
    company: str
    found_vendor_page: bool
    vendor_page_urls: list[str] = Field(default_factory=list)
    actions_summary: list[str] = Field(default_factory=list)
    vendors: list[VendorFinding] = Field(default_factory=list)
    notes: str | None = None


TARGETS = {
    "abridge": ("Abridge", "https://www.abridge.com"),
    "baseten": ("Baseten", "https://www.baseten.co"),
    "cyera": ("Cyera", "https://www.cyera.io"),
    "cohere": ("Cohere", "https://cohere.com"),
    "synthesia": ("Synthesia", "https://www.synthesia.io"),
    "anthropic": ("Anthropic", "https://www.anthropic.com"),
}


def root_domain(url: str) -> str:
    host = urlparse(url).hostname or url
    parts = host.lower().removeprefix("www.").split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def allowed_domains_for(website: str) -> list[str]:
    root = root_domain(website)
    return [
        root,
        f"*.{root}",
        "app.vanta.com",
        "trust.vanta.com",
    ]


def likely_urls(website: str) -> list[str]:
    parsed = urlparse(website)
    root = root_domain(website)
    origin = f"{parsed.scheme or 'https'}://{parsed.netloc or root}"
    trust_origin = f"https://trust.{root}"
    trustcenter_origin = f"https://trustcenter.{root}"
    return [
        f"{trust_origin}/subprocessors",
        trust_origin,
        f"{trustcenter_origin}/subprocessors",
        trustcenter_origin,
        f"{origin}/subprocessors",
        f"{origin}/legal/subprocessors",
        f"{origin}/security",
        f"{origin}/trust",
        f"{origin}/privacy",
    ]


def task_for(company: str, website: str) -> str:
    urls = "\n".join(f"- {url}" for url in likely_urls(website))
    return f"""
You are testing whether an agentic browser can find public vendor/subprocessor data for {company}.

Start from the likely URLs below, prioritizing explicit subprocessor URLs before generic trust/security pages. Stay on the company's own domains or its Vanta-hosted trust center only.
Do not use Google, Bing, Exa, or other web search engines. Do not log in. Do not request access. Do not accept paid terms.
If any URL fails to load, is empty, or has a DNS error, continue to the next likely URL. Do not stop early because one or two URLs fail.

Likely URLs:
{urls}

Goal:
1. Look for public pages, buttons, tabs, menus, accordions, or links labeled Trust, Security, Privacy, Legal, DPA, Subprocessors, Sub-processors, Service Providers, Vendors, or Integrations.
2. If there is a visible tab or button that may reveal subprocessors/vendors, click it.
3. If a list/table is found, do not stop immediately. First check for View all, Show all, See all, Load more, More, Next, pagination, dropdown filters, or a link/href to /subprocessors that may reveal additional rows. Click or navigate to these public controls before extracting the final list.
4. If you discover a trust center domain such as trustcenter.example.com, also try its /subprocessors path before stopping.
5. Extract vendor names and evidence URLs. Prefer actual subprocessor/vendor rows over navigation, countries, headings, or marketing text.
6. Stop once you have either extracted the complete public vendor/subprocessor list or determined no public list is available within the allowed domains.
7. Only determine no public list is available after trying all likely URLs or after a clearly relevant page says the list is not public.

Return structured output only. Include a short actions_summary explaining which buttons/tabs/URLs you tried.
"""


async def run_one(company: str, website: str, model: str, max_steps: int) -> dict:
    llm = ChatOpenAI(model=model, temperature=0.0)
    profile = BrowserProfile(
        headless=True,
        enable_default_extensions=False,
        captcha_solver=False,
        viewport={"width": 1440, "height": 1000},
        wait_for_network_idle_page_load_time=0.75,
        minimum_wait_page_load_time=0.5,
    )
    agent = Agent(
        task=task_for(company, website),
        llm=llm,
        browser_profile=profile,
        output_model_schema=BrowserUseVendorResult,
        use_vision="auto",
        max_failures=2,
        max_actions_per_step=4,
        max_history_items=8,
        calculate_cost=True,
        llm_timeout=60,
        step_timeout=90,
        source="yc_search_vendor_probe",
    )

    started = time.time()
    history = await agent.run(max_steps=max_steps)
    structured = history.structured_output
    if structured and hasattr(structured, "model_dump"):
        payload = structured.model_dump()
    else:
        payload = {
            "company": company,
            "found_vendor_page": False,
            "vendor_page_urls": [],
            "actions_summary": [],
            "vendors": [],
            "notes": history.final_result(),
        }

    payload["browser_use"] = {
        "model": model,
        "steps": history.number_of_steps(),
        "duration_seconds": round(time.time() - started, 2),
        "is_done": history.is_done(),
        "is_successful": history.is_successful(),
        "has_errors": history.has_errors(),
        "urls": history.urls(),
        "actions": history.action_names(),
        "errors": [str(error) for error in history.errors() if error],
    }
    return payload


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--companies", default="abridge,baseten,cyera,cohere,synthesia,anthropic")
    parser.add_argument("--model", default=os.getenv("BROWSER_USE_OPENAI_MODEL", "gpt-4.1-mini"))
    parser.add_argument("--max-steps", type=int, default=int(os.getenv("BROWSER_USE_MAX_STEPS", "14")))
    parser.add_argument("--output", default="tmp/browser-use-vendor-probe.json")
    args = parser.parse_args()

    selected = [item.strip().lower() for item in args.companies.split(",") if item.strip()]
    results = []
    for key in selected:
        if key not in TARGETS:
            raise SystemExit(f"Unknown company key: {key}. Known: {', '.join(TARGETS)}")
        company, website = TARGETS[key]
        print(f"Running Browser Use probe for {company} ({website}) with {args.model}...")
        try:
            results.append(await run_one(company, website, args.model, args.max_steps))
        except Exception as error:
            results.append({
                "company": company,
                "found_vendor_page": False,
                "vendor_page_urls": [],
                "actions_summary": [],
                "vendors": [],
                "notes": f"Probe failed: {error}",
                "browser_use": {
                    "model": args.model,
                    "steps": 0,
                    "duration_seconds": 0,
                    "is_done": False,
                    "is_successful": False,
                    "has_errors": True,
                    "urls": [],
                    "actions": [],
                    "errors": [str(error)],
                },
            })

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps({
        "output": str(output_path),
        "companies": len(results),
        "vendor_counts": {result["company"]: len(result.get("vendors", [])) for result in results},
    }, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
