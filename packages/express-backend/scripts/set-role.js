// Give an existing account a different role, e.g. promote
// someone who signed up (signups start as viewers):
//
//   npm run set-role -- --email teammate@calpoly.edu --role editor
//
// Roles: viewer, editor, admin. Takes effect on their next
// request; no need to sign out.
import { parseArgs } from "node:util";
import { ROLES, isValidRole } from "../src/auth/roles.js";
import { normalizeEmail } from "../src/auth/userStore.js";
import { openStoreForScript } from "./open-store.js";

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

const { userStore, close } = await openStoreForScript();
const user = await userStore.findByEmail(email);
if (!user) {
  console.error(`No account for ${email}.`);
  await close();
  process.exit(1);
}

const admins = (await userStore.list()).filter(
  (u) => u.role === "admin"
);
if (
  user.role === "admin" &&
  values.role !== "admin" &&
  admins.length === 1
) {
  console.error(
    "That's the only admin. Make someone else an admin first."
  );
  await close();
  process.exit(1);
}

await userStore.update(user.id, { role: values.role });
console.log(`${email}: ${user.role} → ${values.role}`);
await close();
