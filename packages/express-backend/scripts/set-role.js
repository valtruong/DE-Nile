// Give an existing account a different role, e.g. promote
// someone who signed up (signups start as viewers):
//
//   npm run set-role -- --email teammate@calpoly.edu --role editor
//
// Roles: viewer, editor, admin. Takes effect on their next
// request; no need to sign out.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { ROLES, isValidRole } from "../src/auth/roles.js";
import {
  normalizeEmail,
  readUsers,
  writeUsers
} from "../src/auth/userStore.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const usersFile =
  process.env.USERS_FILE ??
  path.join(here, "..", "data", "users.json");

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    role: { type: "string" }
  }
});

const email = normalizeEmail(values.email);
if (!email || !isValidRole(values.role)) {
  console.error(
    `Usage: npm run set-role -- --email a@calpoly.edu --role <${ROLES.join("|")}>`
  );
  process.exit(1);
}

const users = readUsers(usersFile);
const user = users.find(
  (u) => normalizeEmail(u.email) === email
);
if (!user) {
  console.error(`No account for ${email}.`);
  process.exit(1);
}

const admins = users.filter((u) => u.role === "admin");
if (
  user.role === "admin" &&
  values.role !== "admin" &&
  admins.length === 1
) {
  console.error(
    "That's the only admin. Make someone else an admin first."
  );
  process.exit(1);
}

const previous = user.role;
user.role = values.role;
writeUsers(usersFile, users);
console.log(`${email}: ${previous} → ${values.role}`);
