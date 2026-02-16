import { getDb } from "./db";
import { getSimilarCompanies } from "./company-details";

type EmbeddingRow = {
  id: number;
  name: string;
  vector: string;
};

type CachedProjection = {
  signature: string;
  points: Array<{ id: number; name: string; x: number; y: number }>;
};

let projectionCache: CachedProjection | null = null;

function dot(a: number[], b: number[]) {
  let total = 0;
  for (let i = 0; i < a.length; i += 1) {
    total += a[i] * b[i];
  }
  return total;
}

function norm(values: number[]) {
  return Math.sqrt(dot(values, values));
}

function normalize(values: number[]) {
  const valueNorm = norm(values) || 1;
  return values.map((value) => value / valueNorm);
}

function matVecCentered(embeddings: number[][], vector: number[]) {
  const n = embeddings.length;
  const d = vector.length;
  const output = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    let sum = 0;
    const row = embeddings[i];
    for (let j = 0; j < d; j += 1) {
      sum += row[j] * vector[j];
    }
    output[i] = sum;
  }
  return output;
}

function transposeMatVec(embeddings: number[][], values: number[]) {
  const n = embeddings.length;
  const d = embeddings[0]?.length ?? 0;
  const output = new Array<number>(d).fill(0);
  for (let i = 0; i < n; i += 1) {
    const row = embeddings[i];
    const scale = values[i];
    for (let j = 0; j < d; j += 1) {
      output[j] += row[j] * scale;
    }
  }
  return output;
}

function powerIteration(
  embeddings: number[][],
  iterations: number,
  orthogonalTo?: number[],
) {
  const d = embeddings[0]?.length ?? 0;
  let vector: number[] = new Array<number>(d)
    .fill(0)
    .map((_, index) => (index % 3 === 0 ? 1 : 0.5));

  for (let step = 0; step < iterations; step += 1) {
    const projected = matVecCentered(embeddings, vector);
    vector = transposeMatVec(embeddings, projected);

    if (orthogonalTo) {
      const projection = dot(vector, orthogonalTo);
      for (let i = 0; i < vector.length; i += 1) {
        vector[i] -= projection * orthogonalTo[i];
      }
    }

    vector = normalize(vector);
  }

  return vector;
}

function centerEmbeddings(vectors: number[][]) {
  if (!vectors.length) {
    return vectors;
  }
  const dimension = vectors[0].length;
  const means = new Array<number>(dimension).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < dimension; i += 1) {
      means[i] += vector[i];
    }
  }
  for (let i = 0; i < dimension; i += 1) {
    means[i] /= vectors.length;
  }

  return vectors.map((vector) => vector.map((value, index) => value - means[index]));
}

function parseEmbeddingRows(rows: EmbeddingRow[]) {
  const vectors: number[][] = [];
  const labels: Array<{ id: number; name: string }> = [];

  for (const row of rows) {
    try {
      const vector = JSON.parse(row.vector) as number[];
      if (Array.isArray(vector) && vector.length > 1) {
        vectors.push(vector);
        labels.push({ id: row.id, name: row.name });
      }
    } catch {
      // Skip malformed vectors.
    }
  }

  return { vectors, labels };
}

function computePcaProjection(rows: EmbeddingRow[]) {
  const { vectors, labels } = parseEmbeddingRows(rows);
  if (!vectors.length) {
    return [];
  }

  const centered = centerEmbeddings(vectors);
  const component1 = powerIteration(centered, 14);
  const component2 = powerIteration(centered, 14, component1);
  const xValues = matVecCentered(centered, component1);
  const yValues = matVecCentered(centered, component2);

  return labels.map((label, index) => ({
    id: label.id,
    name: label.name,
    x: Number(xValues[index].toFixed(6)),
    y: Number(yValues[index].toFixed(6)),
  }));
}

function loadProjection() {
  const db = getDb();
  const signatureRow = db
    .prepare<[], { signature: string }>(`
      SELECT
        CAST(COUNT(*) AS TEXT) || '-' || COALESCE(MAX(updated_at), 'none') AS signature
      FROM company_embeddings
    `)
    .get();

  const signature = signatureRow?.signature ?? "none";
  if (projectionCache && projectionCache.signature === signature) {
    return projectionCache.points;
  }

  const rows = db
    .prepare<[], EmbeddingRow>(`
      SELECT c.id, c.name, e.vector
      FROM company_embeddings e
      INNER JOIN companies c ON c.id = e.company_id
    `)
    .all();

  const points = computePcaProjection(rows);
  projectionCache = {
    signature,
    points,
  };
  return points;
}

export function getCompanyEmbeddingMap(companyId: number, similarLimit = 12) {
  const points = loadProjection();
  const selectedPoint = points.find((point) => point.id === companyId);
  if (!selectedPoint) {
    return null;
  }

  const similarIds = new Set(getSimilarCompanies(companyId, similarLimit).map((company) => company.id));
  const mappedPoints = points
    .filter((point) => point.id === companyId || similarIds.has(point.id))
    .map((point) => ({
      ...point,
      group: point.id === companyId ? ("selected" as const) : ("similar" as const),
    }));

  return {
    method: "PCA",
    selectedCompanyId: companyId,
    points: mappedPoints,
  };
}
