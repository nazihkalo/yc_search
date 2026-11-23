/** Bounded categories only. Never return the user's question or query. */
export function questionMetadata(text: string) {
  const value = text.toLowerCase();
  const intent = /summari[sz]e|summary|overview/.test(value)
    ? "summary"
    : /compar|versus|\bvs\b/.test(value)
      ? "comparison"
      : /vendor|subprocessor|provider|tech stack/.test(value)
        ? "vendor_research"
        : /founder|cofounder/.test(value)
          ? "founder_research"
          : /competitor|market|landscape|space/.test(value)
            ? "market_research"
            : /idea|validat|building/.test(value)
              ? "idea_validation"
              : "company_research";
  const topics = [
    ["ai", /\bai\b|artificial intelligence|\bllm/],
    ["fintech", /fintech|payment|banking/],
    ["health", /health|medical|biotech/],
    ["developer_tools", /developer|\bapi\b|infrastructure/],
    ["security", /security|compliance|privacy/],
    ["climate", /climate|energy/],
  ] as const;
  return {
    intent,
    topics: topics
      .filter(([, pattern]) => pattern.test(value))
      .map(([topic]) => topic),
    question_length: text.length,
    summary_type:
      intent === "summary"
        ? /batch|\b[wsf]\d{2}\b/.test(value)
          ? "batch"
          : /vendor|provider/.test(value)
            ? "vendors"
            : /market|industry|sector/.test(value)
              ? "market"
              : "companies"
        : "none",
  };
}

export function sanitizeAnalyticsUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

/** Copilot's info/connect/continuation requests aren't new user questions. */
export function copilotQuestion(
  envelope: unknown,
): { id: string; text: string } | null {
  if (!envelope || typeof envelope !== "object") return null;
  const request = envelope as {
    method?: string;
    body?: {
      messages?: Array<{ id?: unknown; role?: unknown; content?: unknown }>;
    };
  };
  if (request.method !== "agent/run" || !Array.isArray(request.body?.messages))
    return null;
  const last = request.body.messages.at(-1);
  if (
    last?.role !== "user" ||
    typeof last.content !== "string" ||
    typeof last.id !== "string" ||
    !last.content.trim()
  )
    return null;
  return { id: last.id, text: last.content };
}

/** Remove SDK attribution URLs, including nested person properties. */
export function redactAnalyticsProperties(properties: Record<string, unknown>) {
  const result = { ...properties };
  for (const key of ["$set", "$set_once"]) {
    const value = result[key];
    if (value && typeof value === "object") result[key] = { ...value };
  }
  for (const bag of [result, result.$set, result.$set_once]) {
    if (!bag || typeof bag !== "object") continue;
    for (const key of Object.keys(bag)) {
      if (/url|referrer|utm_|search_keyword/i.test(key))
        delete (bag as Record<string, unknown>)[key];
    }
  }
  return result;
}

export function assistantRunOutcome(
  messages: readonly {
    role: string;
    content?: unknown;
    toolCalls?: readonly unknown[];
  }[],
) {
  const last = messages.at(-1);
  if (
    last?.role === "tool" ||
    (last?.role === "assistant" && last.toolCalls?.length)
  )
    return "tool_handoff";
  if (
    last?.role === "assistant" &&
    typeof last.content === "string" &&
    last.content.trim()
  )
    return "answer";
  return "empty";
}
