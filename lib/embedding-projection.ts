export type ProjectionPoint = {
  x: number;
  y: number;
  z: number;
};

const COMPONENT_COUNT = 3;
const POWER_ITERATIONS = 18;
const EPSILON = 1e-9;
const GRAPH_SCALE_XY = 180;
const GRAPH_SCALE_Z = 110;

export function projectEmbeddings(
  embeddings: Array<{ id: number; vector: number[] }>,
): Map<number, ProjectionPoint> {
  const usable = embeddings.filter((entry) => entry.vector.length > 0);
  if (usable.length === 0) {
    return new Map();
  }
  if (usable.length === 1) {
    return new Map([[usable[0].id, { x: 0, y: 0, z: 0 }]]);
  }

  const dimensions = usable.reduce(
    (min, entry) => Math.min(min, entry.vector.length),
    Number.POSITIVE_INFINITY,
  );
  if (!Number.isFinite(dimensions) || dimensions <= 0) {
    return new Map();
  }

  const means = new Array(dimensions).fill(0);
  for (const entry of usable) {
    for (let index = 0; index < dimensions; index += 1) {
      means[index] += entry.vector[index] ?? 0;
    }
  }
  for (let index = 0; index < dimensions; index += 1) {
    means[index] /= usable.length;
  }

  const centered = usable.map((entry) => {
    const row = new Array(dimensions);
    for (let index = 0; index < dimensions; index += 1) {
      row[index] = (entry.vector[index] ?? 0) - means[index];
    }
    return row;
  });

  const componentScores: number[][] = [];
  for (let componentIndex = 0; componentIndex < COMPONENT_COUNT; componentIndex += 1) {
    const component = findPrincipalComponent(centered, dimensions, componentIndex);
    const scores = centered.map((row) => dot(row, component));
    componentScores.push(scores);

    for (let rowIndex = 0; rowIndex < centered.length; rowIndex += 1) {
      const score = scores[rowIndex];
      const row = centered[rowIndex];
      for (let dimension = 0; dimension < dimensions; dimension += 1) {
        row[dimension] -= score * component[dimension];
      }
    }
  }

  const scales = componentScores.map((scores, index) => robustScale(scores, index === 2 ? GRAPH_SCALE_Z : GRAPH_SCALE_XY));
  const output = new Map<number, ProjectionPoint>();

  for (let index = 0; index < usable.length; index += 1) {
    output.set(usable[index].id, {
      x: normalizeScore(componentScores[0]?.[index] ?? 0, scales[0]),
      y: normalizeScore(componentScores[1]?.[index] ?? 0, scales[1]),
      z: normalizeScore(componentScores[2]?.[index] ?? 0, scales[2]),
    });
  }

  return output;
}

function findPrincipalComponent(rows: number[][], dimensions: number, componentIndex: number) {
  let vector = deterministicSeedVector(dimensions, componentIndex);

  for (let iteration = 0; iteration < POWER_ITERATIONS; iteration += 1) {
    const candidate = new Array(dimensions).fill(0);
    for (const row of rows) {
      const score = dot(row, vector);
      for (let index = 0; index < dimensions; index += 1) {
        candidate[index] += row[index] * score;
      }
    }
    vector = normalize(candidate);
  }

  return orientDeterministically(vector);
}

function deterministicSeedVector(dimensions: number, componentIndex: number) {
  const seed = new Array(dimensions);
  const offset = componentIndex + 1;
  for (let index = 0; index < dimensions; index += 1) {
    seed[index] = Math.sin((index + 1) * (12.9898 + offset)) + Math.cos((index + 1) * (78.233 + offset));
  }
  return normalize(seed);
}

function dot(a: number[], b: number[]) {
  let total = 0;
  for (let index = 0; index < a.length; index += 1) {
    total += a[index] * (b[index] ?? 0);
  }
  return total;
}

function normalize(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude <= EPSILON) {
    return vector.map(() => 0);
  }
  return vector.map((value) => value / magnitude);
}

function orientDeterministically(vector: number[]) {
  let largestIndex = 0;
  for (let index = 1; index < vector.length; index += 1) {
    if (Math.abs(vector[index]) > Math.abs(vector[largestIndex])) {
      largestIndex = index;
    }
  }
  return vector[largestIndex] < 0 ? vector.map((value) => -value) : vector;
}

function robustScale(scores: number[], target: number) {
  const absolute = scores
    .map((score) => Math.abs(score))
    .filter((score) => Number.isFinite(score))
    .sort((a, b) => a - b);
  if (absolute.length === 0) {
    return { denominator: 1, target };
  }
  const index = Math.min(absolute.length - 1, Math.floor(absolute.length * 0.9));
  return { denominator: Math.max(absolute[index], EPSILON), target };
}

function normalizeScore(score: number, scale: { denominator: number; target: number }) {
  if (!Number.isFinite(score)) return 0;
  return Math.max(-scale.target, Math.min(scale.target, (score / scale.denominator) * scale.target));
}
