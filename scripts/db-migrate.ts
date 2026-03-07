import { closeDb, initializeDatabase } from "../lib/db";

async function main() {
  await initializeDatabase();
  console.log("Database schema is up to date.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
