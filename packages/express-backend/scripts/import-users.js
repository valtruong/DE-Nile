// Copy accounts from a local data/users.json into the shared
// MongoDB database, so accounts made before the switch keep
// working (same passwords, roles and verification status).
//
//   npm run import-users
//   npm run import-users -- --file path/to/users.json
//
// Accounts whose email is already in the database are
// skipped, so it's safe to run more than once.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { readUsers } from "../src/auth/userStore.js";
import { openStoreForScript } from "./open-store.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({
  options: {
    file: {
      type: "string",
      default: path.join(here, "..", "data", "users.json")
    }
  }
});

if (!process.env.MONGODB_URI) {
  console.error(
    "Set MONGODB_URI in .env first; this copies accounts into the shared database."
  );
  process.exit(1);
}

const local = readUsers(values.file);
if (local.length === 0) {
  console.log(`No accounts in ${values.file}.`);
  process.exit(0);
}

const { userStore, close } = await openStoreForScript();
let added = 0;
for (const user of local) {
  if (await userStore.findByEmail(user.email)) {
    console.log(`skip   ${user.email} (already in database)`);
    continue;
  }
  await userStore.create(user);
  added += 1;
  console.log(`added  ${user.email} (${user.role})`);
}
console.log(
  `Done: ${added} added, ${local.length - added} skipped.`
);
await close();
