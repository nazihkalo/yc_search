import { initializeDatabase } from "../lib/db";

function main() {
  initializeDatabase();
  console.log("Database schema is up to date.");
}

main();
