const VECTOR_DIMENSIONS = 1536;

export const EMBEDDING_DIMENSIONS = VECTOR_DIMENSIONS;

export function toVectorLiteral(vector: number[]) {
  return `[${vector.join(",")}]`;
}

export function parseVectorString(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is number => typeof item === "number");
    }
  } catch {
    // Fall through to a lighter parser for pgvector text output.
  }

  const normalized = value.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (!normalized) {
    return [];
  }

  return normalized
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

export function normalizeQueryEmbeddingInput(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
