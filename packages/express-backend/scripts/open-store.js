// Shared by the scripts: loads .env and opens the same
// account store the server uses (MongoDB if MONGODB_URI is
// set, otherwise data/users.json).
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: path.join(here, "..", ".env"),
  quiet: true
});

export async function openStoreForScript() {
  const { openUserStore } = await import("../src/db.js");
  try {
    const store = await openUserStore();
    console.log(`Accounts: ${store.where}`);
    return store;
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
