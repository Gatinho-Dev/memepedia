import "server-only";
import { count, getDb, get } from "./db";
import { isSeeded, seedDatabase } from "./seed";

let ready = false;

/**
 * Idempotent first-run setup: creates the schema and, on a fresh database,
 * loads the demo catalogue so the platform is never an empty shell.
 */
export function bootstrap(): void {
  if (ready) return;
  getDb();
  if (!isSeeded()) seedDatabase();
  ready = true;
}

export function isFreshInstall(): boolean {
  return count("SELECT COUNT(*) FROM users") === 0;
}

export { isSeeded };
