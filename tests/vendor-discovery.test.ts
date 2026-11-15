import assert from "node:assert/strict";
import { test } from "node:test";
import { extractLikelyTrustLinks, extractVendorMentionsFromMarkdown, getVendorCandidateRejectionReason, getVendorEvidenceRejectionReason } from "../lib/vendor-intelligence";
import { hasFailedDisclosureSource, htmlLinksAsMarkdown, readBoundedHtml } from "../lib/vendor-discovery";
import { formatVendorError } from "../lib/vendor-errors";

test("homepage links discover hosted trust centers without accepting lookalike hosts", () => {
  const markdown = htmlLinksAsMarkdown(`<footer>
    <a href="https://acme.safebase.io/">Trust center</a>
    <a href="https://trust.acme.co.uk/subprocessors">Subprocessors</a>
    <a href="https://trust.other.co.uk/subprocessors">Other company</a>
    <a href="https://safebase.io.evil.test/">Security</a>
    <a href="https://vanta.com/products/trust-center">Powered by Vanta</a>
    <a href="https://user:password@acme.co.uk/privacy">Privacy</a>
    <a href="javascript:alert(1)">Trust</a>
  </footer>`);
  const links = extractLikelyTrustLinks(markdown, "https://acme.co.uk", true);
  assert(links.includes("https://acme.safebase.io/"));
  assert(links.includes("https://trust.acme.co.uk/subprocessors"));
  assert(!links.some((url) => url.includes("other.co.uk") || url.includes("evil.test") || url.includes("password")));
  assert(!links.some((url) => url.startsWith("javascript:")));
  assert(!links.some((url) => url.includes("/products/")));
});

test("homepage link parser decodes query separators and caps downloaded HTML", async () => {
  assert.equal(htmlLinksAsMarkdown('<a href="/legal?type=dpa&amp;lang=en"><span>Data processing</span></a>'),
    "[Data processing](/legal?type=dpa&lang=en)");
  assert.equal(await readBoundedHtml(new Response("123456789"), 4), "1234");
});

test("child errors expose the actual failure without logging source code or API credentials", () => {
  const child = Object.assign(new Error("Command failed: python -c [entire bridge source]"), {
    stdout: 'log line\n{"success":false,"error":"Browser navigation timed out"}', stderr: "warning",
  });
  assert.equal(formatVendorError(child), "Crawler failed: Browser navigation timed out");
  assert.equal(formatVendorError(new Error("Incorrect API key: sk-proj-secret-value Bearer private-token")),
    "Incorrect API key: [redacted] Bearer [redacted]");
});

test("hosted trust center cards yield vendors outside the seed dictionary", () => {
  const markdown = `# Subprocessors\nPylon • Customer Support\nUnited States\nOrb\nInvoicing\nUnited States\nwithorb.com\n${"These subprocessors provide the listed services and process customer data. ".repeat(20)}`;
  const mentions = extractVendorMentionsFromMarkdown(markdown, "https://trust.example.com/subprocessors", "browser");
  assert(mentions.some((mention) => mention.canonicalName === "Pylon"));
  assert(mentions.some((mention) => mention.canonicalName === "Orb"));
  assert(!mentions.some((mention) => mention.canonicalName.includes("•")));
  assert(mentions.every((mention) => mention.relationshipType === "subprocessor"));
  assert.equal(getVendorCandidateRejectionReason("Exa Trust Center"), "trust_center_navigation");
});

test("a timed-out guessed path does not turn an otherwise completed crawl into an outage", () => {
  const official = new Set(["https://example.com", "https://example.com/legal/vendors"]);
  const checks = [{ url: "https://example.com/subprocessors", status: "timeout" }];
  assert.equal(hasFailedDisclosureSource(checks, official, new Set()), false);
  const actual = [{ url: "https://example.com/legal/vendors", status: "http_error", httpStatus: 403 }];
  assert.equal(hasFailedDisclosureSource(actual, official, new Set()), true);
  assert.equal(hasFailedDisclosureSource(actual, official, new Set([actual[0].url])), false);
});

test("AWS evidence uses the whole vendor name rather than the substring in laws", () => {
  const markdown = `We comply with applicable laws. ${"General legal introduction. ".repeat(30)}\n# Subprocessors\nAWS provides our cloud hosting services.`;
  const aws = extractVendorMentionsFromMarkdown(markdown, "https://example.com/subprocessors", "http")
    .find((mention) => mention.canonicalName === "Amazon Web Services");
  assert(aws);
  assert.match(aws.evidenceSnippet, /AWS provides our cloud hosting/);
});

test("generic Google and Microsoft mentions do not imply cloud product adoption", () => {
  const mentions = extractVendorMentionsFromMarkdown("Google sign-on is offered as a primary authentication option. We also support Microsoft accounts.",
    "https://example.com/privacy", "http");
  assert(!mentions.some((mention) => mention.canonicalName === "Google Cloud"));
  assert(!mentions.some((mention) => mention.canonicalName === "Microsoft Azure"));
});

test("a footer GitHub link and a URL-only brand are insufficient vendor disclosures", () => {
  const mentions = extractVendorMentionsFromMarkdown("# Privacy\n## Network\n[GitHub](https://github.com/example)\nExecute our [DPA form](https://ironcladapp.com/public-launch/example).",
    "https://example.com/privacy", "http");
  const github = mentions.find((mention) => mention.canonicalName === "GitHub");
  const ironclad = mentions.find((mention) => mention.canonicalName === "Ironclad");
  assert(github);
  assert(ironclad);
  assert.equal(getVendorEvidenceRejectionReason(github), "navigation_only_vendor_link");
  assert.equal(getVendorEvidenceRejectionReason(ironclad), "vendor_not_named_in_visible_evidence");
});
