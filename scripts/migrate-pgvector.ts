import { closeDb, queryOne, withTransaction } from "../lib/db";

async function main() {
  await withTransaction(async (client) => {
    const extension = await queryOne<{ installed: boolean }>(
      `
        SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') AS installed
      `,
      {},
      client,
    );

    if (!extension?.installed) {
      await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    }

    await client.query(`
      ALTER TABLE company_embeddings
      ALTER COLUMN "vector" TYPE vector(1536)
      USING ("vector"::vector(1536))
    `);

    await client.query(`
      ALTER TABLE query_embeddings
      ALTER COLUMN "vector" TYPE vector(1536)
      USING ("vector"::vector(1536))
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_company_embeddings_vector_hnsw
        ON company_embeddings
        USING hnsw (vector vector_cosine_ops)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_query_embeddings_vector_hnsw
        ON query_embeddings
        USING hnsw (vector vector_cosine_ops)
    `);
  });

  console.log("pgvector migration completed.");
}

main()
  .catch((error) => {
    if (error instanceof Error && /extension "vector" is not available/i.test(error.message)) {
      console.error(
        [
          "pgvector migration failed because the connected Postgres instance does not have the vector extension installed.",
          "Move the database to a pgvector-enabled Postgres instance, then rerun `npm run db:migrate:pgvector`.",
        ].join("\n"),
      );
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
